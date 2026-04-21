/**
 * PayPal redirect-mode return handler.
 *
 * PayPal sends the shopper here after they approve (or cancel) the
 * payment on paypal.com. The URL carries:
 *   - `token` — the PayPal order id (confusingly named; this is the
 *     v2 /checkout/orders id, not an access token).
 *   - `PayerID` — optional. Present on approval; absent on cancel.
 *
 * Flow:
 *   1. Look up the orders row by `paypal_order_id = token`.
 *   2. If already captured (idempotency), just redirect to the
 *      success panel.
 *   3. Otherwise, call capture, update the row based on the result,
 *      and redirect to /checkout with the outcome encoded in the
 *      query string so the checkout page can show the right panel.
 *
 * We never trust query params alone — the authority is always the
 * capture API response. That way, a shopper who hand-edits the URL
 * can't fake a payment.
 */

import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { capturePaypalOrder } from "@/lib/paypal"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const paypalOrderId = url.searchParams.get("token")

  // Helper: build an absolute redirect back to the checkout page with
  // a normalized set of flags the client-side effect knows how to
  // interpret.
  const checkoutReturn = (
    params: Record<string, string>,
  ): NextResponse => {
    const target = new URL("/checkout", url.origin)
    for (const [k, v] of Object.entries(params)) {
      target.searchParams.set(k, v)
    }
    return NextResponse.redirect(target, { status: 303 })
  }

  if (!paypalOrderId) {
    // No token on the URL — either the shopper bailed or PayPal
    // pinged the wrong endpoint. Report a generic failure.
    return checkoutReturn({ paypal_status: "failed" })
  }

  try {
    const supabase = createAdminClient()

    // 1) Find the order we created for this PayPal order id.
    const { data: order, error: lookupErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, payment_status, paypal_order_id, paypal_capture_id",
      )
      .eq("paypal_order_id", paypalOrderId)
      .maybeSingle()

    if (lookupErr) {
      console.error("[v0] PayPal return lookup error:", lookupErr.message)
      return checkoutReturn({ paypal_status: "failed" })
    }
    if (!order) {
      console.warn("[v0] PayPal return: no order for token", { paypalOrderId })
      return checkoutReturn({ paypal_status: "failed" })
    }

    // 2) Idempotency — if we already captured this order, don't
    //    re-call PayPal. Just send the shopper to the success panel.
    if (order.payment_status === "paid" || order.paypal_capture_id) {
      return checkoutReturn({
        paypal_status: "paid",
        order: order.order_number ?? "",
      })
    }

    // 3) Capture. Errors here are transient — surface as "pending"
    //    so the customer isn't told their payment failed when we
    //    just couldn't reach PayPal momentarily.
    let captureResult
    try {
      captureResult = await capturePaypalOrder(paypalOrderId)
    } catch (err) {
      console.error("[v0] PayPal capture threw:", err)
      return checkoutReturn({
        paypal_status: "pending",
        order: order.order_number ?? "",
      })
    }

    // 4) Persist the capture outcome on the order row. Escalate
    //    payment_status to `paid` only — never regress an already
    //    paid order from a late/duplicate return.
    const update: Record<string, unknown> = {
      paypal_status: captureResult.status,
      paypal_capture_id: captureResult.captureId,
      paypal_amount_paid: captureResult.amountCents,
      paypal_updated_at: new Date().toISOString(),
    }
    if (captureResult.paid && order.payment_status !== "paid") {
      update.payment_status = "paid"
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.id)

    if (updateErr) {
      // The charge succeeded on PayPal's side but our DB write
      // failed. The payment is still valid — report paid so the
      // customer gets the success experience. An admin will see
      // the mismatch in the logs and can fix it manually.
      console.error("[v0] PayPal return update error:", updateErr.message)
    }

    return checkoutReturn({
      paypal_status: captureResult.paid ? "paid" : "failed",
      order: order.order_number ?? "",
    })
  } catch (err) {
    console.error("[v0] PayPal return handler threw:", err)
    return checkoutReturn({ paypal_status: "failed" })
  }
}
