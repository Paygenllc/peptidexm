/**
 * Shipping fee rules.
 *
 * US orders:
 *   - $20 flat
 *   - FREE when the cart subtotal is at or above `US_FREE_SHIPPING_THRESHOLD`
 * International orders:
 *   - $50 flat (no free-shipping threshold yet)
 *
 * The free-shipping threshold is compared against **subtotal** (pre-shipping,
 * pre-tax) on purpose: this prevents shipping charges from inflating a cart
 * into qualifying for its own waiver.
 */
export const US_SHIPPING_FEE = 20
export const INTL_SHIPPING_FEE = 50
export const US_FREE_SHIPPING_THRESHOLD = 500

const US_ALIASES = new Set([
  "united states",
  "united states of america",
  "usa",
  "u.s.",
  "u.s.a.",
  "us",
])

export function isUSCountry(country: string | null | undefined): boolean {
  if (!country) return false
  return US_ALIASES.has(country.trim().toLowerCase())
}

/**
 * Returns the shipping fee for a given destination + cart subtotal.
 *
 * `subtotal` is optional so older call sites that don't know the cart value
 * keep working — they simply won't get the US free-shipping discount. New
 * call sites (checkout, place-order, cart) always pass it.
 *
 * `forceFree` is the global free-shipping override, driven by the
 * `shipping_free_all_enabled` flag in `public.site_settings`. When the
 * admin flips this on from the Shipping settings page, every destination
 * (US and international) and every subtotal ships at $0. This is a
 * blunt-instrument promo — use for site-wide campaigns, not granular
 * coupon codes.
 */
export function getShippingFee(
  country: string | null | undefined,
  subtotal?: number,
  forceFree?: boolean,
): number {
  if (forceFree) return 0
  if (isUSCountry(country)) {
    if (typeof subtotal === "number" && subtotal >= US_FREE_SHIPPING_THRESHOLD) {
      return 0
    }
    return US_SHIPPING_FEE
  }
  return INTL_SHIPPING_FEE
}

/**
 * Dollars remaining before a US cart qualifies for free shipping.
 * Returns 0 when the cart already qualifies. Returns null for non-US carts
 * (no promo applies) so the UI can choose to render nothing.
 */
export function amountToFreeShipping(
  country: string | null | undefined,
  subtotal: number,
): number | null {
  if (!isUSCountry(country)) return null
  const remaining = US_FREE_SHIPPING_THRESHOLD - subtotal
  return remaining > 0 ? remaining : 0
}
