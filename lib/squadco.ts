/**
 * Squadco shared utilities.
 *
 * We don't ship webhook signature verification anymore — the Squadco
 * merchant dashboard for this account exposes a Redirect URL but no
 * webhook URL, so payment confirmation is pulled on redirect via the
 * transaction-verify endpoint instead of pushed via HMAC-signed POSTs.
 *
 * What remains here is the one piece used by both the redirect-verify
 * action and any future status-polling cron: a mapping from Squadco's
 * transaction_status vocabulary to our canonical payment_status enum.
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
