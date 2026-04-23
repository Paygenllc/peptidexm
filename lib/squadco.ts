/**
 * Squadco shared utilities.
 *
 * Payment confirmation flows through three converging channels, all
 * of which funnel into the same canonical `payment_status` value
 * produced by `squadcoStatusToPaymentStatus` below:
 *
 *   1. The `/api/squadco/webhook` route — signed POSTs Squad sends
 *      when a charge settles. This is the authoritative path.
 *   2. The `verifyCardPaymentAction` server action — pulled by the
 *      checkout page's iframe handler the moment Squad's redirect
 *      URL lands (`?transaction_ref=...` in the query string).
 *   3. The same action's polling loop — a fallback for the narrow
 *      window where the webhook is still in flight and the iframe
 *      hasn't redirected yet.
 *
 * All three use this single mapping so the UI, the webhook, and the
 * admin dashboard can never disagree about what "success" means.
 */

/**
 * Map Squadco's transaction_status strings to our canonical
 * payment_status vocabulary. We intentionally keep the canonical set
 * tight (`paid | failed | partial | pending`) and widen only when we
 * have a UX for a new state.
 */
export function squadcoStatusToPaymentStatus(
  raw: string | undefined | null,
): "paid" | "failed" | "partial" | "pending" {
  if (!raw) return "pending"
  const s = raw.toLowerCase()
  if (s === "success" || s === "successful" || s === "paid" || s === "completed") {
    return "paid"
  }
  if (s === "failed" || s === "declined" || s === "reversed") {
    return "failed"
  }
  // "partial" is rare on card rails but documented for pay-in-parts
  // links. Flag for admin review rather than auto-fulfilling.
  if (s === "partial" || s === "partially_paid" || s === "underpaid") {
    return "partial"
  }
  return "pending"
}
