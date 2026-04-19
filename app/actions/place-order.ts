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
}

export async function placeOrderAction(input: PlaceOrderInput) {
  if (!input.email || !input.email.includes("@")) return { error: "Valid email is required" }
  if (!input.items || input.items.length === 0) return { error: "Cart is empty" }

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

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      status: "processing",
      payment_status: "pending",
      payment_method: "zelle",
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
