/**
 * Squadco webhook utilities.
 *
 * Squadco signs every webhook payload with HMAC-SHA512 using the
 * merchant's secret key (or a separate webhook secret if configured in
 * the dashboard) and sends the hex digest in the `x-squad-encrypted-body`
 * request header. The receiving server must:
 *
 *   1. Read the RAW request body (no parsing first — any reformatting
 *      will invalidate the signature).
 *   2. Compute HMAC-SHA512(body, secret) → hex string.
 *   3. Compare (case-insensitively, constant-time) against the header.
 *
 * Docs: https://docs.squadco.com/webhook
 */

import crypto from "crypto"

/**
 * Webhook payload shape. Squadco's docs describe an "Event" wrapper for
 * newer integrations and a flat body for older ones, so we accept both
 * and normalize in the handler. Everything is optional here — field
 * presence is checked at the call site.
 */
export interface SquadcoWebhookPayload {
  Event?: string
  TransactionRef?: string
  Body?: {
    transaction_ref?: string
    amount?: number
    currency?: string
    transaction_status?: string
    email?: string
    merchant_amount?: number
    meta?: Record<string, unknown> | null
    payment_information?: {
      payment_method?: string
      channel?: string
      hash?: string
      reference?: string
    } | null
  } | null
  // Flat / alternate shapes we've seen in payment-link webhooks.
  transaction_ref?: string
  transaction_status?: string
  amount?: number
  currency?: string
  hash?: string
  data?: {
    transaction_ref?: string
    hash?: string
    amount?: number
    currency?: string
    transaction_status?: string
  } | null
}

/**
 * Verify the `x-squad-encrypted-body` signature against the raw request
 * body. Returns false for any missing piece so the handler can bail out.
 *
 * We use `timingSafeEqual` to avoid leaking comparison timing; the
 * lengths must match first, so we early-return on mismatch.
 */
export function verifySquadcoSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature || !secret || !rawBody) return false

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody, "utf8")
    .digest("hex")

  // Squadco's docs vary on case; normalize both sides to lowercase before
  // the constant-time comparison.
  const a = Buffer.from(expected.toLowerCase(), "utf8")
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8")

  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

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

/**
 * Extract the matching key we use to find the order row. Squadco puts
 * the hash in different places depending on which endpoint generated
 * the charge, so we check every plausible location in priority order:
 *
 *   1. payment_information.hash  (Payment Links API — primary path)
 *   2. data.hash                 (some alternate payloads)
 *   3. transaction_ref           (when the hash isn't echoed, the
 *      transaction_ref often matches the link's hash because we set
 *      hash = reference on creation)
 */
export function extractSquadcoHash(
  payload: SquadcoWebhookPayload,
): string | null {
  return (
    payload.Body?.payment_information?.hash ??
    payload.data?.hash ??
    payload.hash ??
    payload.Body?.payment_information?.reference ??
    payload.Body?.transaction_ref ??
    payload.data?.transaction_ref ??
    payload.transaction_ref ??
    payload.TransactionRef ??
    null
  )
}
