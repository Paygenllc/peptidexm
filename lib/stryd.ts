/**
 * Stryd Pay shared utilities.
 *
 * The Stryd integration mirrors the same three-channel reconciliation
 * pattern we use for Squadco:
 *
 *   1. The `/api/stryd/webhook` route — signed POSTs Stryd sends when
 *      a charge settles. HMAC-SHA256 verified before any field is
 *      trusted. This is the authoritative path.
 *   2. The `verifyCardPaymentAction` server action (Stryd variant) —
 *      pulled by the checkout page when Stryd's redirect URL lands
 *      with `?tx_ref=...&status=...`.
 *   3. The same action's polling loop — fallback for the brief window
 *      between redirect and webhook.
 *
 * All three funnel into the canonical `payment_status` vocabulary
 * defined here.
 */

/**
 * Stryd's hosted checkout API base. From the Stryd Pay developer
 * guide:
 *
 *   POST {base}/api-checkout         → create checkout session
 *   GET  {base}/api-checkout-status  → poll session by tx_ref
 *
 * The host is fixed by Stryd (it's their backend), so we hard-code
 * it. Auth is per-request via the `x-api-key` header.
 */
export const STRYD_API_BASE =
  "https://rcrraujlnlnxlxyyguls.supabase.co/functions/v1"

/**
 * Map Stryd's transaction status strings to our canonical
 * payment_status vocabulary. Stryd uses two slightly different status
 * fields depending on which endpoint we're talking to:
 *
 *   - `/api-checkout-status` returns `"completed" | "pending"`.
 *   - The webhook payload includes both `status: "successful"` and
 *     `event: "payment.completed"`. We accept either.
 *
 * Keeping the canonical set tight (`paid | failed | partial | pending`)
 * makes it impossible for the UI, webhook, and admin dashboard to
 * disagree about what "success" means.
 */
export function strydStatusToPaymentStatus(
  raw: string | undefined | null,
): "paid" | "failed" | "partial" | "pending" {
  if (!raw) return "pending"
  const s = raw.toLowerCase()
  if (
    s === "completed" ||
    s === "success" ||
    s === "successful" ||
    s === "paid"
  ) {
    return "paid"
  }
  if (s === "failed" || s === "declined" || s === "cancelled" || s === "canceled") {
    return "failed"
  }
  // Stryd doesn't currently document a partial state, but we keep the
  // branch so the canonical mapping function has identical shape to
  // its Squadco counterpart and a future status string can land here.
  if (s === "partial" || s === "underpaid") {
    return "partial"
  }
  return "pending"
}
