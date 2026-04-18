"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { sendOrderStatusUpdateEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/types"

/**
 * Update an order from the admin detail form.
 *
 * Automatically notifies the customer by email for every meaningful change
 * (status, payment, tracking added/changed, cancellation, or an admin note).
 * Admins can suppress the email by unchecking "Notify customer" in the form.
 */
export async function updateOrderAction(formData: FormData) {
  await requireAdmin()

  const orderId = String(formData.get("orderId") || "")
  const status = String(formData.get("status") || "")
  const paymentStatus = String(formData.get("payment_status") || "")
  const trackingNumber = String(formData.get("tracking_number") || "").trim()
  const trackingCarrier = String(formData.get("tracking_carrier") || "").trim()
  const trackingUrl = String(formData.get("tracking_url") || "").trim()
  const notes = String(formData.get("notes") || "").trim()
  const notifyCustomer = formData.get("notify_customer") !== "off"

  if (!orderId) return { error: "Missing order id" }
  if (!ORDER_STATUSES.includes(status as OrderStatus)) return { error: "Invalid status" }
  if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) return { error: "Invalid payment status" }

  const supabase = await createClient()

  const { data: before, error: loadErr } = await supabase
    .from("orders")
    .select(
      "id, order_number, email, first_name, last_name, status, payment_status, tracking_carrier, tracking_number, tracking_url, notes, total",
    )
    .eq("id", orderId)
    .single()

  if (loadErr || !before) {
    console.error("[v0] updateOrderAction: load failed", loadErr)
    return { error: "Order not found" }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status,
      payment_status: paymentStatus,
      tracking_number: trackingNumber || null,
      tracking_carrier: trackingCarrier || null,
      tracking_url: trackingUrl || null,
      notes: notes || null,
    })
    .eq("id", orderId)

  if (error) {
    console.error("[v0] updateOrderAction error", error)
    return { error: error.message }
  }

  // Figure out what to tell the customer. Only send one email per update
  // — a shipping push wins over a status-only push, etc.
  if (notifyCustomer && before.email) {
    const statusChanged = status !== before.status
    const paymentChanged = paymentStatus !== before.payment_status
    const trackingNowSet = !!(trackingNumber && trackingNumber !== (before.tracking_number ?? ""))
    const carrierChanged = (trackingCarrier || null) !== (before.tracking_carrier ?? null)
    const noteChanged = (notes || null) !== (before.notes ?? null)

    const customerName =
      `${before.first_name ?? ""} ${before.last_name ?? ""}`.trim() || before.email

    const maybeSend = async () => {
      // Shipping event has the highest priority.
      if (status === "shipped" && (trackingNumber || before.tracking_number)) {
        await sendOrderStatusUpdateEmail({
          kind: "shipped",
          orderNumber: before.order_number,
          customerName,
          customerEmail: before.email,
          trackingCarrier: trackingCarrier || before.tracking_carrier,
          trackingNumber: trackingNumber || before.tracking_number,
          trackingUrl: trackingUrl || before.tracking_url,
          note: notes || null,
        })
        return
      }

      if (status === "cancelled" && statusChanged) {
        await sendOrderStatusUpdateEmail({
          kind: "cancelled",
          orderNumber: before.order_number,
          customerName,
          customerEmail: before.email,
          note: notes || null,
        })
        return
      }

      if (paymentChanged) {
        await sendOrderStatusUpdateEmail({
          kind: "payment",
          orderNumber: before.order_number,
          customerName,
          customerEmail: before.email,
          status,
          paymentStatus,
          note: notes || null,
        })
        return
      }

      if (statusChanged) {
        await sendOrderStatusUpdateEmail({
          kind: "status",
          orderNumber: before.order_number,
          customerName,
          customerEmail: before.email,
          status,
          note: notes || null,
        })
        return
      }

      if (trackingNowSet || carrierChanged) {
        await sendOrderStatusUpdateEmail({
          kind: "status",
          orderNumber: before.order_number,
          customerName,
          customerEmail: before.email,
          status,
          trackingCarrier: trackingCarrier || before.tracking_carrier,
          trackingNumber: trackingNumber || before.tracking_number,
          trackingUrl: trackingUrl || before.tracking_url,
          note: notes || null,
        })
        return
      }

      if (noteChanged && notes) {
        await sendOrderStatusUpdateEmail({
          kind: "status",
          orderNumber: before.order_number,
          customerName,
          customerEmail: before.email,
          status,
          note: notes,
        })
      }
    }

    try {
      await maybeSend()
    } catch (emailErr) {
      console.error("[v0] updateOrderAction: email failed", emailErr)
      // Intentionally swallow — the DB update already succeeded and the
      // customer can still see the change on their account page.
    }
  }

  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin")
  revalidatePath("/account")
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
