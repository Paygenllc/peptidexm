"use server"

/**
 * Server actions for the PayPal redirect checkout flow.
 *
 * We use a redirect-style integration (no JS SDK, no webhook) to keep
 * the behaviour symmetrical with the existing card rail:
 *   1. `startPaypalCheckoutAction` — creates the PayPal order via
 *      REST, persists the PayPal order id + approve URL on our
 *      orders row, and returns the approve URL for the client to
 *      redirect to.
 *   2. The PayPal approval page sends the customer to
 *      `/api/paypal/return?token=<paypal_order_id>` on success.
 *   3. That return route captures, updates our row, and redirects
 *      back to /checkout with the paypal_* query flags set.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { createPaypalOrder } from "@/lib/paypal"

type StartResult =
  | { ok: true; approveUrl: string; paypalOrderId: string }
  | { ok: false; error: string }

/**
 * Creates a PayPal order for an already-placed orders row and writes
 * the PayPal order id + approve URL back onto the row so the return
 * route can reconcile the payment without relying on a webhook.
 */
export async function startPaypalCheckoutAction(input: {
  orderId: string
  orderNumber: string
  amountCents: number
  returnUrl: string
  cancelUrl: string
}): Promise<StartResult> {
  const { orderId, orderNumber, amountCents, returnUrl, cancelUrl } = input

  if (!orderId || !orderNumber) {
    return { ok: false, error: "Missing order identifier." }
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Invalid order total." }
  }
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return { ok: false, error: "PayPal is not configured." }
  }

  try {
    const created = await createPaypalOrder({
      amountCents,
      currency: "USD",
      orderNumber,
      returnUrl,
      cancelUrl,
    })

    // Persist the PayPal order id on the row. This is the only link
    // between our order and PayPal's — the return route uses it to
    // confirm the payment belongs to a real order before capturing.
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("orders")
      .update({
        paypal_order_id: created.id,
        paypal_approve_url: created.approveUrl,
        paypal_status: created.status,
        paypal_updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (error) {
      console.error("[v0] startPaypalCheckoutAction persist error:", error.message)
      // The order exists on PayPal's side but we couldn't save the
      // link on our side. The shopper can still complete; support
      // will have to reconcile manually via the capture log if they
      // do. Report loudly so we notice in production.
      return {
        ok: false,
        error: "Could not start PayPal checkout. Please try again.",
      }
    }

    return { ok: true, approveUrl: created.approveUrl, paypalOrderId: created.id }
  } catch (err) {
    console.error("[v0] startPaypalCheckoutAction threw:", err)
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : "Could not start PayPal checkout.",
    }
  }
}
