"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getShippingFee } from "@/lib/shipping"
import {
  sendOrderPlacedAdminEmail,
  sendOrderPlacedCustomerEmail,
  type OrderEmailInput,
} from "@/lib/email"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import {
  classifySource,
  type AttributionPayload,
} from "@/lib/traffic-source"

/**
 * Pull first-touch attribution off the `pxm_attr` cookie the
 * <AttributionBeacon /> drops on landing. Returns empty values if the cookie
 * is missing or malformed — attribution is best-effort, never fatal.
 */
async function readAttributionFromCookie(): Promise<AttributionPayload> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get("pxm_attr")?.value
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<AttributionPayload>
    return {
      referrer: parsed.referrer ?? null,
      landing_path: parsed.landing_path ?? null,
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
      utm_term: parsed.utm_term ?? null,
      utm_content: parsed.utm_content ?? null,
    }
  } catch (err) {
    console.log("[v0] placeOrder: failed to parse pxm_attr cookie", err)
    return {}
  }
}

interface OrderItemInput {
  productName: string
  variantName: string
  unitPrice: number
  quantity: number
  imageUrl?: string | null
}

interface PlaceOrderInput {
  email: string
  phone: string
  firstName: string
  lastName: string
  address: string
  address2?: string
  city: string
  state: string
  zipCode: string
  country: string
  items: OrderItemInput[]
  /**
   * How the shopper intends to pay. Determines the post-order flow:
   *  - "zelle"  → show Zelle payment panel on the success screen (default)
   *  - "crypto" → redirect to NOWPayments hosted invoice via createCryptoInvoiceAction
   *  - "card"   → order placed, customer redirected to Squadco payment link (via webhook)
   */
  paymentMethod?: "zelle" | "crypto" | "card"
}

const ALLOWED_PAYMENT_METHODS = new Set<PlaceOrderInput["paymentMethod"]>(["zelle", "crypto", "card"])

export async function placeOrderAction(input: PlaceOrderInput) {
  if (!input.email || !input.email.includes("@")) return { error: "Valid email is required" }
  if (!input.items || input.items.length === 0) return { error: "Cart is empty" }

  // Honor the admin payment-method toggles server-side. A client with
  // a stale page, browser cache, or a hand-crafted request can't
  // bypass the UI by posting a disabled method — we block it here.
  // Import is dynamic to avoid pulling the server supabase client into
  // modules that statically import this file outside of a request.
  const { getPaymentMethodToggles } = await import("@/lib/payment-methods")
  const toggles = await getPaymentMethodToggles()
  const requestedMethod = input.paymentMethod ?? "zelle"
  if (!toggles[requestedMethod]) {
    return {
      error:
        "This payment method is currently unavailable. Please choose another option.",
    }
  }

  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  // Pass subtotal so US orders at/over the free-shipping threshold get $0
  // shipping server-side — client values are never trusted for pricing.
  const shipping = getShippingFee(input.country, subtotal)
  const tax = 0
  const total = subtotal + shipping + tax

  // Capture authenticated user if present (for linking orders to accounts)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Use admin client to bypass RLS for guest checkout inserts
  const admin = createAdminClient()

  // Validate against the allowlist; fall back to zelle if anything unexpected
  // was passed. Never trust the client to pick an arbitrary method string.
  const paymentMethod =
    input.paymentMethod && ALLOWED_PAYMENT_METHODS.has(input.paymentMethod)
      ? input.paymentMethod
      : "zelle"

  // First-touch attribution (from the cookie dropped on site landing).
  // We also look at the current request `host` to correctly classify
  // internal-vs-external referrers without hardcoding a domain.
  const attribution = await readAttributionFromCookie()
  const hdrs = await headers()
  const siteHost =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? null
  const sourceChannel = classifySource(attribution, siteHost)

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      status: "processing",
      payment_status: "pending",
      payment_method: paymentMethod,
      email: input.email.trim(),
      phone: input.phone.trim() || null,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      address_line1: input.address.trim(),
      address_line2: input.address2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      zip_code: input.zipCode.trim(),
      country: input.country.trim() || "United States",
      subtotal,
      shipping,
      tax,
      total,
      user_id: user?.id ?? null,
      // Attribution — all optional; null when the cookie was missing.
      referrer: attribution.referrer || null,
      landing_path: attribution.landing_path || null,
      source_channel: sourceChannel,
      utm_source: attribution.utm_source || null,
      utm_medium: attribution.utm_medium || null,
      utm_campaign: attribution.utm_campaign || null,
      utm_term: attribution.utm_term || null,
      utm_content: attribution.utm_content || null,
    })
    .select("id, order_number")
    .single()

  if (orderError || !order) {
    console.error("[v0] placeOrder insert error", orderError)
    return { error: orderError?.message || "Failed to create order" }
  }

  const itemRows = input.items.map((i) => ({
    order_id: order.id,
    product_name: i.productName,
    variant_name: i.variantName,
    image_url: i.imageUrl ?? null,
    unit_price: i.unitPrice,
    quantity: i.quantity,
    line_total: i.unitPrice * i.quantity,
  }))

  const { error: itemsError } = await admin.from("order_items").insert(itemRows)
  if (itemsError) {
    console.error("[v0] placeOrder items error", itemsError)
    // Rollback the order
    await admin.from("orders").delete().eq("id", order.id)
    return { error: itemsError.message }
  }

  revalidatePath("/admin/orders")
  revalidatePath("/admin")
  if (user?.id) revalidatePath("/account")

  // Close out any open abandoned-cart row for this email so the cron
  // doesn't keep sending reminders to a shopper who's already paid.
  // Matched case-insensitively (`ilike`) because the capture endpoint
  // stores the email lowercased but the checkout form preserves case.
  // Errors here are not fatal — the order already succeeded.
  const normalizedEmail = input.email.trim().toLowerCase()
  const { error: recoverErr } = await admin
    .from("abandoned_carts")
    .update({
      recovered_at: new Date().toISOString(),
      recovered_order_id: order.id,
    })
    .ilike("email", normalizedEmail)
    .is("recovered_at", null)
  if (recoverErr) {
    console.log("[v0] abandoned-cart recover mark error:", recoverErr)
  }
  revalidatePath("/admin/abandoned-carts")

  // Fire-and-forget confirmation emails (do not block the checkout response)
  const emailPayload: OrderEmailInput = {
    orderNumber: order.order_number,
    total,
    customerName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim() || input.email.trim(),
    customerEmail: input.email.trim(),
    shippingAddress: [
      input.address.trim(),
      input.address2?.trim() || "",
      `${input.city.trim()}, ${input.state.trim()} ${input.zipCode.trim()}`.trim(),
      input.country.trim() || "United States",
    ]
      .filter(Boolean)
      .join("\n"),
    items: input.items.map((i) => ({
      name: i.productName,
      variant: i.variantName,
      quantity: i.quantity,
      price: i.unitPrice,
    })),
  }
  void Promise.allSettled([
    sendOrderPlacedCustomerEmail(emailPayload),
    sendOrderPlacedAdminEmail(emailPayload),
  ])

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.order_number,
    total,
  }
}
