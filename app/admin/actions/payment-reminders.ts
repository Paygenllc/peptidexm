"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSiteUrl } from "@/lib/abandoned-carts"
import { sendPaymentReminderEmail } from "@/lib/email"
import {
  MAX_PAYMENT_REMINDERS,
  daysSince,
  type PendingOrderRow,
} from "@/lib/payment-reminders"

/**
 * Manually send a payment reminder for a specific order. Used by the
 * "Send payment reminder" button on the admin order detail page. Unlike
 * the cron, this doesn't enforce a time-based cooldown — the operator
 * can send at any time — but it DOES enforce:
 *
 *  - Only orders with payment_status = pending receive reminders.
 *  - Orders already cancelled or refunded are rejected.
 *  - MAX_PAYMENT_REMINDERS is still honored so a single order can't
 *    accumulate an unbounded number of sends.
 *
 * Returns a discriminated result so the client button can show feedback
 * without having to guess from HTTP semantics.
 */
export async function sendPaymentReminderAction(orderId: string) {
  try {
    await requireAdmin()
    if (!orderId) return { error: "Missing order id" }

    const admin = createAdminClient()
    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, order_number, email, first_name, last_name, total, status, payment_status, payment_reminder_count, last_payment_reminder_sent_at, created_at",
      )
      .eq("id", orderId)
      .maybeSingle<PendingOrderRow>()

    if (error) {
      console.log("[v0] payment reminder fetch error:", error)
      return { error: error.message }
    }
    if (!order) return { error: "Order not found" }

    if (order.payment_status !== "pending") {
      return { error: `Order payment status is "${order.payment_status}" — no reminder needed.` }
    }
    if (order.status === "cancelled" || order.status === "refunded") {
      return { error: `Order is ${order.status} — cannot send reminder.` }
    }

    const sentCount = order.payment_reminder_count ?? 0
    if (sentCount >= MAX_PAYMENT_REMINDERS) {
      return {
        error: `This order has already received ${MAX_PAYMENT_REMINDERS} reminders. Consider cancelling it instead.`,
      }
    }

    const ordinal = (sentCount + 1) as 1 | 2 | 3
    const customerName = [order.first_name, order.last_name].filter(Boolean).join(" ").trim() || "there"
    const payUrl = `${getSiteUrl()}/account`

    const result = await sendPaymentReminderEmail({
      orderNumber: order.order_number,
      total: Number(order.total),
      customerName,
      customerEmail: order.email,
      ordinal,
      daysSinceOrder: daysSince(order.created_at),
      payUrl,
    })

    // sendEmail returns a 3-way discriminated union:
    //   { skipped: true }                — no Resend API key configured
    //   { skipped: false, id }           — email accepted
    //   { skipped: false, error }        — Resend or network error (unknown)
    // The manual "send reminder" button should treat `skipped:true` as a
    // hard error (the operator clicked Send and nothing happened), which
    // is different from the cron behavior where we just no-op.
    if ("error" in result && result.error !== undefined) {
      const msg = result.error instanceof Error ? result.error.message : String(result.error)
      console.log("[v0] payment reminder send failed:", msg)
      return { error: msg || "Email failed to send" }
    }
    if (result.skipped) {
      return {
        error:
          "Email is not configured on the server (missing RESEND_API_KEY). No reminder was sent.",
      }
    }

    // Only bump counters AFTER the email actually sent, so a transient
    // Resend failure doesn't burn a slot.
    const { error: updErr } = await admin
      .from("orders")
      .update({
        payment_reminder_count: sentCount + 1,
        last_payment_reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (updErr) {
      console.log("[v0] payment reminder counter update failed:", updErr)
      // Don't fail the action — the email went out; counter will just
      // under-count. Operator still sees success in the UI.
    }

    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)

    return { success: true as const, ordinal, sentCount: sentCount + 1 }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log("[v0] sendPaymentReminderAction threw:", err)
    return { error: msg || "Could not send reminder." }
  }
}
