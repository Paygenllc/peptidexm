"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getShippingFee } from "@/lib/shipping"
import { getFreeShippingEnabled } from "@/lib/shipping.server"
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
   *  - "card"   → order placed, customer redirected to Squadco payment link
   *  - "paypal" → order placed, customer redirected to PayPal approve URL;
   *               captured by `/api/paypal/return` on completion
   */
  paymentMethod?: "zelle" | "crypto" | "card" | "paypal"
  /**
   * Optional coupon code the customer applied at checkout. Re-validated
   * server-side via `validate_coupon` — the client-computed `amountOff`
   * is never trusted. If validation fails the order still proceeds at
   * full price (we don't want to break checkout because a coupon
   * expired between page-render and place-order), but the failure is
   * surfaced via the response so the UI can flag it.
   */
  couponCode?: string
}

const ALLOWED_PAYMENT_METHODS = new Set<PlaceOrderInput["paymentMethod"]>(["zelle", "crypto", "card", "paypal"])

export async function placeOrderAction(input: PlaceOrderInput) {
  if (!input.email || !input.email.includes("@")) return { error: "Valid email is required" }
  if (!input.items || input.items.length === 0) return { error: "Cart is empty" }

  // Honor the admin payment-method toggles server-side. A client with
  // a stale page, browser cache, or a hand-crafted request can't
  // bypass the UI by posting a disabled method — we block it here.
  // Import from the server-only module (the client-safe one holds
  // only the types/constants, not the DB read).
  const { getPaymentMethodToggles } = await import("@/lib/payment-methods.server")
  const toggles = await getPaymentMethodToggles()
  const requestedMethod = input.paymentMethod ?? "zelle"
  if (!toggles[requestedMethod]) {
    return {
      error:
        "This payment method is currently unavailable. Please choose another option.",
    }
  }

  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  // Resolve the site-wide free-shipping override from site_settings.
  // This is the authoritative pricing path — client values are never
  // trusted, and the admin's toggle in /admin/settings/shipping is the
  // single source of truth for whether this order gets comped shipping.
  const freeShippingOverride = await getFreeShippingEnabled()
  // Pass subtotal so US orders at/over the free-shipping threshold get $0
  // shipping server-side, and pass the override so every destination
  // (US + international) respects the admin flip when it's on.
  const shipping = getShippingFee(input.country, subtotal, freeShippingOverride)
  const tax = 0

  // Coupon validation runs against the same SECURITY DEFINER RPC the
  // /api/coupons/validate endpoint uses, so we get exactly one source
  // of truth for the discount math. We re-validate here (even though
  // the UI already did) because the customer may have sat on the page
  // long enough for the coupon to expire or hit its max_uses, and
  // because nothing stops a tampered request from posting a bogus
  // amount_off. A failed validation is non-fatal: the order proceeds
  // at full price and the response carries `couponWarning` so the UI
  // can show "Coupon could not be applied — order placed at full
  // price" instead of silently swallowing the discount.
  let couponId: string | null = null
  let couponCodeStored: string | null = null
  let couponAmountOff = 0
  let couponWarning: string | undefined
  const couponCodeInput = input.couponCode?.trim()
  if (couponCodeInput) {
    const supabaseForCoupon = await createClient()
    const { data: validated, error: couponErr } = await supabaseForCoupon.rpc(
      "validate_coupon",
      {
        p_code: couponCodeInput,
        p_email: input.email.trim() || null,
        p_subtotal: subtotal,
      },
    )
    if (couponErr) {
      const { couponErrorMessage } = await import("@/lib/coupons")
      couponWarning = couponErrorMessage(couponErr.message)
      console.log("[v0] placeOrder: coupon validation failed", couponErr.message)
    } else {
      const row = Array.isArray(validated) ? validated[0] : validated
      if (row) {
        couponId = row.coupon_id as string
        couponCodeStored = (row.code as string) ?? couponCodeInput
        // Postgres returns NUMERIC as string — coerce at the boundary.
        couponAmountOff = Math.min(Number(row.amount_off), subtotal)
      }
    }
  }

  const total = Math.max(0, subtotal - couponAmountOff + shipping + tax)

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
      // Coupon snapshot — code + amount-off are stored even if the
      // coupon row is later deleted (FK is `on delete set null`).
      // That preserves auditability of historical orders.
      coupon_id: couponId,
      coupon_code: couponCodeStored,
      coupon_amount_off: couponAmountOff,
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

  // Redeem the coupon now that the order row is committed. The RPC
  // is idempotent on (coupon_id, order_id) so a retry is safe; it
  // increments redemption_count under a row-level lock so two
  // simultaneous checkouts can't both push past max_uses. If
  // redemption fails (e.g. someone else just claimed the last use),
  // we roll back the order completely — better to surface the error
  // than to charge the customer at the discounted total without ever
  // recording the redemption.
  if (couponId) {
    const { error: redeemErr } = await admin.rpc("redeem_coupon", {
      p_coupon_id: couponId,
      p_order_id: order.id,
      p_email: input.email.trim() || null,
      p_amount_off: couponAmountOff,
      p_subtotal: subtotal,
    })
    if (redeemErr) {
      console.error("[v0] placeOrder coupon redeem error", redeemErr)
      await admin.from("order_items").delete().eq("order_id", order.id)
      await admin.from("orders").delete().eq("id", order.id)
      const { couponErrorMessage } = await import("@/lib/coupons")
      return { error: couponErrorMessage(redeemErr.message) }
    }
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

  // Fire-and-forget confirmation emails (do not block the checkout response).
  // `paymentMethod` is the rail we just validated and wrote to the DB row,
  // not the raw `input.paymentMethod` — guarantees the customer and admin
  // templates always describe the rail that was actually stored, even if
  // a hand-crafted request had tried to pass an unsupported value.
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
    paymentMethod,
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
    // The UI shows a "Coupon could not be applied" toast when the
    // customer entered a code that validate_coupon rejected. We still
    // succeed — the order placed at full price — but the operator and
    // the customer get a heads-up.
    couponWarning,
    couponAmountOff,
  }
}
