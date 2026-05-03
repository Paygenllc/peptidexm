/**
 * Shared coupon types + error mapping. Pure module — safe to import
 * from server actions, route handlers, and client components.
 *
 * The discount types `percent` and `fixed` mirror the Postgres
 * CHECK constraint on `coupons.type`. Keep them in sync; widening
 * here without a migration will lose money the next time someone
 * picks "BOGO" in the admin UI and the DB rejects the insert.
 */

export type CouponType = "percent" | "fixed"

/**
 * What `validate_coupon` returns. Money is always serialized as a
 * `string` over Postgres NUMERIC — coercion to Number happens at the
 * boundary, not here, so we don't accidentally introduce float drift
 * when a coupon math operates on cents-precision totals.
 */
export interface ValidatedCoupon {
  couponId: string
  code: string
  type: CouponType
  value: number
  amountOff: number
}

/**
 * Centralized error code → user-friendly message map. The Postgres
 * RPCs raise these as exception messages so the client surface can
 * pick the right copy. New error codes added in SQL must be added
 * here too — the fallback `couponErrorMessage()` returns a generic
 * "Coupon could not be applied." if we don't recognize the key.
 */
export const COUPON_ERROR_MESSAGES: Record<string, string> = {
  coupon_not_found: "We couldn't find that coupon code.",
  coupon_inactive: "That coupon is no longer active.",
  coupon_not_started: "That coupon isn't valid yet.",
  coupon_expired: "That coupon has expired.",
  coupon_min_order: "Order subtotal is below this coupon's minimum.",
  coupon_email_locked: "That coupon is reserved for a different email.",
  coupon_max_uses_reached: "That coupon has reached its usage limit.",
  coupon_max_per_customer_reached: "You've already used this coupon.",
  coupon_invalid_args: "Coupon could not be applied.",
  email_invalid: "Please enter a valid email address.",
}

/**
 * Maps an arbitrary Postgres error message to a user-safe sentence.
 * Postgres raises `coupon_expired` (etc.) as the literal exception
 * text, so we look it up directly. Any unknown shape gets a generic
 * fallback so we never leak internal error strings to the customer.
 */
export function couponErrorMessage(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? "")
  // Try an exact match first (the RPC raises bare keys), then look
  // for a key embedded in a longer Postgres-formatted message.
  if (COUPON_ERROR_MESSAGES[text]) return COUPON_ERROR_MESSAGES[text]
  for (const key of Object.keys(COUPON_ERROR_MESSAGES)) {
    if (text.includes(key)) return COUPON_ERROR_MESSAGES[key]!
  }
  return "Coupon could not be applied."
}

/**
 * Money formatter shared by the checkout summary and the admin
 * coupons table. Stays in lib so we don't ship Intl twice.
 */
export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
