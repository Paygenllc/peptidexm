"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
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
  const shipping = subtotal > 500 ? 0 : 15
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

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.order_number,
  }
}
