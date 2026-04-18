export const US_SHIPPING_FEE = 20
export const INTL_SHIPPING_FEE = 50

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

export function getShippingFee(country: string | null | undefined): number {
  return isUSCountry(country) ? US_SHIPPING_FEE : INTL_SHIPPING_FEE
}
