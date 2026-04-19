"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import { sendAbandonedCartReminderEmail } from "@/lib/email"
import {
  MAX_REMINDERS,
  getSiteUrl,
  type AbandonedCartRow,
} from "@/lib/abandoned-carts"

/**
 * Fires a reminder email on demand from the admin UI. Honors the same
 * `MAX_REMINDERS` cap as the cron so an admin clicking the button three
 * times doesn't spam a shopper — they'll get the typed error response
 * back and the UI shows it inline.
 */
export async function sendAbandonedCartReminderAction(formData: FormData) {
  try {
    await requireAdmin()
    const id = String(formData.get("id") || "")
    if (!id) return { error: "Missing cart id" }

    const admin = createAdminClient()
    const { data: cart, error: selErr } = await admin
      .from("abandoned_carts")
      .select("*")
      .eq("id", id)
      .maybeSingle<AbandonedCartRow>()

    if (selErr) {
      console.log("[v0] abandoned-cart manual send select error:", selErr)
      return { error: selErr.message }
    }
    if (!cart) return { error: "Cart not found" }
    if (cart.recovered_at) return { error: "Cart has already been recovered" }
    if (cart.reminder_count >= MAX_REMINDERS) {
      return { error: `Already sent ${MAX_REMINDERS} reminders — stopping here to protect deliverability.` }
    }
    if (!Array.isArray(cart.items) || cart.items.length === 0) {
      return { error: "Cart has no items" }
    }

    const ordinal = (cart.reminder_count + 1) as 1 | 2
    const recoveryUrl = `${getSiteUrl()}/recover-cart/${encodeURIComponent(cart.token)}`

    const emailResult = await sendAbandonedCartReminderEmail({
      firstName: cart.first_name,
      customerEmail: cart.email,
      ordinal,
      subtotal: Number(cart.subtotal) || 0,
      items: cart.items,
      recoveryUrl,
    })

    if ("error" in emailResult && emailResult.error) {
      console.log("[v0] abandoned-cart manual send email error:", emailResult.error)
      return { error: "Could not send email. Check Resend logs." }
    }
    if ("skipped" in emailResult && emailResult.skipped) {
      return { error: "Email service is not configured (RESEND_API_KEY missing)." }
    }

    const { error: updErr } = await admin
      .from("abandoned_carts")
      .update({
        reminder_count: cart.reminder_count + 1,
        last_reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", cart.id)

    if (updErr) {
      console.log("[v0] abandoned-cart manual send update error:", updErr)
      // Email already sent; we don't want to double-send on retry. Surface
      // the DB error but consider this a partial success.
      return { error: `Email sent but counter update failed: ${updErr.message}` }
    }

    revalidatePath("/admin/abandoned-carts")
    return { success: true as const, ordinal }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log("[v0] sendAbandonedCartReminderAction threw:", err)
    return { error: msg || "Could not send reminder." }
  }
}

/**
 * Hard-deletes an abandoned cart — used when an admin has sorted out the
 * shopper over another channel and wants to clear the dashboard row.
 */
export async function deleteAbandonedCartAction(formData: FormData) {
  try {
    await requireAdmin()
    const id = String(formData.get("id") || "")
    if (!id) return { error: "Missing cart id" }

    const admin = createAdminClient()
    const { error } = await admin.from("abandoned_carts").delete().eq("id", id)
    if (error) {
      console.log("[v0] abandoned-cart delete error:", error)
      return { error: error.message }
    }

    revalidatePath("/admin/abandoned-carts")
    return { success: true as const }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log("[v0] deleteAbandonedCartAction threw:", err)
    return { error: msg || "Could not delete cart." }
  }
}
