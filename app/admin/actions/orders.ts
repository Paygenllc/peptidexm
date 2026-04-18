"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/types"

export async function updateOrderAction(formData: FormData) {
  await requireAdmin()

  const orderId = String(formData.get("orderId") || "")
  const status = String(formData.get("status") || "")
  const paymentStatus = String(formData.get("payment_status") || "")
  const trackingNumber = String(formData.get("tracking_number") || "").trim()
  const trackingCarrier = String(formData.get("tracking_carrier") || "").trim()
  const notes = String(formData.get("notes") || "").trim()

  if (!orderId) return { error: "Missing order id" }
  if (!ORDER_STATUSES.includes(status as OrderStatus)) return { error: "Invalid status" }
  if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) return { error: "Invalid payment status" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      payment_status: paymentStatus,
      tracking_number: trackingNumber || null,
      tracking_carrier: trackingCarrier || null,
      notes: notes || null,
    })
    .eq("id", orderId)

  if (error) {
    console.error("[v0] updateOrderAction error", error)
    return { error: error.message }
  }

  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true }
}

export async function deleteOrderAction(orderId: string) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from("orders").delete().eq("id", orderId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/orders")
  return { success: true }
}
