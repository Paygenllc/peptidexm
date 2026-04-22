"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { sendPaymentSubmittedAdminEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"

interface SubmitPaymentInput {
  orderNumber: string
  reference: string
  email?: string
}

// Very defensive: reject anything that looks like a product/peptide reference
// so customers don't accidentally leak research terms into the Zelle memo.
// The scientific names (tirzepatide/semaglutide/retatrutide/cagrilintide) stay
// in the list because customers often still refer to the molecules that way
// even after the XM-* rebrand, and we need the bank memo to stay clean
// regardless of which label the customer uses.
const FORBIDDEN_PATTERNS = [
  /peptide/i,
  /tirzepatide|semaglutide|retatrutide|cagrilintide/i,
  /\bxm[- ]?[tsrc]\b/i,
  /bpc[- ]?157|tb[- ]?500|ghk[- ]?cu|mk[- ]?677/i,
  /research|compound|vial|kit/i,
]

export async function submitPaymentAction(input: SubmitPaymentInput) {
  const orderNumber = input.orderNumber.trim()
  const reference = input.reference.trim()
  const email = input.email?.trim().toLowerCase() || null

  if (!orderNumber) return { error: "Order number is required" }
  if (!reference) return { error: "Payment reference is required" }
  if (reference.length < 3 || reference.length > 120) {
    return { error: "Payment reference looks invalid" }
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(reference)) {
      return {
        error:
          "Your reference must not contain product names. Send only your order number in the Zelle memo and paste the Zelle confirmation code here.",
      }
    }
  }

  const admin = createAdminClient()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Look up the order. Match by order_number AND (logged-in user_id OR submitted email)
  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("id, order_number, email, user_id, first_name, last_name, total, payment_reference")
    .eq("order_number", orderNumber)
    .maybeSingle()

  if (fetchError) {
    console.error("[v0] submitPayment fetch error", fetchError)
    return { error: "Could not verify order" }
  }
  if (!order) return { error: "We could not find an order with that number" }

  const ownedByUser = user?.id && order.user_id && order.user_id === user.id
  const ownedByEmail = email && order.email?.toLowerCase() === email
  if (!ownedByUser && !ownedByEmail) {
    return { error: "Order details do not match. Double-check your email and order number." }
  }

  if (order.payment_reference) {
    return { error: "A payment reference has already been submitted for this order." }
  }

  // Note: we don't touch payment_status here — it stays "pending" until the admin
  // verifies the Zelle transfer arrived, at which point they flip it to "paid".
  // The orders.payment_status CHECK constraint only allows pending/paid/failed/refunded,
  // so writing anything else (e.g. "submitted") would silently fail the update.
  const { error: updateError } = await admin
    .from("orders")
    .update({
      payment_reference: reference,
      payment_submitted_at: new Date().toISOString(),
    })
    .eq("id", order.id)

  if (updateError) {
    console.error("[v0] submitPayment update error", updateError)
    return { error: "Failed to submit payment reference" }
  }

  revalidatePath("/admin/orders")
  revalidatePath("/admin")
  revalidatePath("/account")

  void sendPaymentSubmittedAdminEmail({
    orderNumber: order.order_number,
    customerName: `${order.first_name ?? ""} ${order.last_name ?? ""}`.trim() || order.email || "Customer",
    customerEmail: order.email || "",
    reference,
    total: Number(order.total ?? 0),
  })

  return { success: true }
}
