import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  verifyIpn,
  npStatusToPaymentStatus,
  type NpIpnPayload,
} from "@/lib/nowpayments"

/**
 * NOWPayments Instant Payment Notification (IPN) webhook.
 *
 * NOWPayments sends a signed JSON POST to this URL whenever a payment
 * transitions state (waiting → confirming → confirmed → finished, etc.).
 * We verify the HMAC-SHA512 signature, match the payload back to our
 * order via `order_id`, and update the order's payment status atomically.
 *
 * We use the service-role key here because the anon role can't update
 * paid-order columns — this webhook is unauthenticated by design and
 * must bypass RLS. Signature verification is the only auth check.
 */

// NOWPayments IPN bodies must be read as raw text so we can re-canonicalize
// them for the signature check before parsing.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-nowpayments-sig")

  if (!verifyIpn(rawBody, signature)) {
    console.warn("[nowpayments/ipn] invalid signature")
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  let payload: NpIpnPayload
  try {
    payload = JSON.parse(rawBody) as NpIpnPayload
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  if (!payload.order_id) {
    // No way to match — ack 200 so NOWPayments stops retrying an unmatchable payload.
    console.warn("[nowpayments/ipn] missing order_id; payload ignored")
    return NextResponse.json({ ok: true, note: "no order_id" })
  }

  const supabase = createAdminClient()

  // Find the order this IPN is about.
  const { data: order, error: loadErr } = await supabase
    .from("orders")
    .select("id, payment_status, nowpayments_status, total")
    .eq("id", payload.order_id)
    .maybeSingle()

  if (loadErr) {
    console.error("[nowpayments/ipn] order lookup error:", loadErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  if (!order) {
    console.warn("[nowpayments/ipn] unknown order_id:", payload.order_id)
    return NextResponse.json({ ok: true, note: "unknown order" })
  }

  // If we've already marked it paid, don't downgrade it — treat the webhook
  // as idempotent. (NOWPayments sometimes sends multiple "finished" IPNs.)
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true, note: "already paid" })
  }

  const newPaymentStatus = npStatusToPaymentStatus(payload.payment_status)

  const update: Record<string, unknown> = {
    nowpayments_payment_id: String(payload.payment_id),
    nowpayments_status: payload.payment_status,
    nowpayments_pay_currency: payload.pay_currency ?? null,
    nowpayments_pay_amount: payload.pay_amount ?? null,
    nowpayments_actually_paid: payload.actually_paid ?? null,
    nowpayments_updated_at: new Date().toISOString(),
  }

  // Only escalate payment_status; never regress it. (e.g. don't flip "paid"
  // back to "awaiting" if a retry IPN arrives out of order.)
  if (newPaymentStatus === "paid" && order.payment_status !== "paid") {
    update.payment_status = "paid"
    update.paid_at = new Date().toISOString()
    update.status = "processing"
  } else if (newPaymentStatus === "failed") {
    update.payment_status = "failed"
  } else if (newPaymentStatus === "partial") {
    // Flag for manual review — don't auto-fulfill underpayments.
    update.payment_status = "partial"
  }

  const { error: upErr } = await supabase
    .from("orders")
    .update(update)
    .eq("id", payload.order_id)

  if (upErr) {
    console.error("[nowpayments/ipn] update error:", upErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
