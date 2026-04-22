/**
 * Resolves the public origin we hand to external payment providers
 * (Squadco, PayPal, etc.) as the "return here when done" URL.
 *
 * Why this exists
 * ---------------
 * By default we'd use `window.location.origin`, which means every
 * payment provider's merchant dashboard logs the customer-facing
 * store domain (e.g. `peptidexm.com`) on every order's redirect_link
 * field. That's fine operationally, but some merchants prefer not to
 * advertise the storefront domain inside a third-party dashboard —
 * chargeback teams, competitors with dashboard access, etc.
 *
 * This util lets a merchant point redirects at a neutral alias
 * domain (e.g. `pay.brand.io`, `orders.anonstore.app`) attached to
 * the same Vercel project. The app itself is bit-for-bit identical
 * at both hostnames, so /checkout and /api/paypal/return work
 * exactly the same — only the hostname the provider sees changes.
 *
 * Resolution order
 * ----------------
 * 1. `NEXT_PUBLIC_PAYMENT_RETURN_ORIGIN` (e.g. "https://pay.brand.io")
 *    — explicit override. Stripped of trailing slashes, validated as
 *    a URL so a typo doesn't silently break payment redirects.
 * 2. `window.location.origin` — fallback for client calls. This is
 *    the historical behavior; nothing changes until the env var is
 *    set.
 * 3. Empty string — SSR safety net. Callers that build URLs against
 *    this should skip their work when the origin is empty (they
 *    already do for `window.location.origin` for the same reason).
 *
 * Exported as a function rather than a constant so the env var can
 * be changed in Vercel without a redeploy (the value is inlined at
 * build time for NEXT_PUBLIC_ vars, but using a function keeps the
 * call site readable and matches how we resolve `window` lazily).
 */
export function getPaymentReturnOrigin(): string {
  const override = process.env.NEXT_PUBLIC_PAYMENT_RETURN_ORIGIN
  if (override && override.trim().length > 0) {
    const trimmed = override.trim().replace(/\/+$/, "")
    // Validate. A bad value here would send customers to a 404 after
    // approving payment on the provider's site — worst possible UX
    // failure mode. Fail open to window.location.origin instead.
    try {
      // Throws for non-URL strings like "pay.brand.io" (missing
      // scheme). We REQUIRE the scheme so the provider's API accepts
      // it; PayPal's create-order call rejects scheme-less URLs.
      new URL(trimmed)
      return trimmed
    } catch {
      if (typeof console !== "undefined") {
        console.warn(
          "[v0] NEXT_PUBLIC_PAYMENT_RETURN_ORIGIN is set but isn't a valid URL; falling back to window.location.origin",
          { value: trimmed },
        )
      }
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }

  return ""
}
