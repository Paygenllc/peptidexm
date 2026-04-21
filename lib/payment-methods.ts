/**
 * Payment-method registry — TYPES AND CONSTANTS ONLY.
 *
 * This module is safe to import from client components. It deliberately
 * has zero server-only dependencies (no `next/headers`, no Supabase
 * server client). The runtime read function lives in
 * `lib/payment-methods.server.ts` and must only be imported from
 * server components, server actions, or route handlers.
 *
 * Why the split: the checkout page is a client component that imports
 * `DEFAULT_PAYMENT_TOGGLES` and the `PaymentMethodToggles` type. If
 * those lived alongside a function that imports `next/headers`, the
 * Next.js 16 Turbopack build fails because it can't prove the client
 * bundle won't pull in a server-only module.
 */

/**
 * The payment rails the checkout can present. Keep this in sync with
 * `app/actions/place-order.ts#ALLOWED_PAYMENT_METHODS`.
 *
 * `paypal` is opt-in: the merchant has to enable it in the admin
 * settings UI and supply PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET as
 * env vars before the checkout will show it as a choice.
 */
export type PaymentMethodKey = "card" | "zelle" | "crypto" | "paypal"

export type PaymentMethodToggles = Record<PaymentMethodKey, boolean>

/**
 * Map of toggle key → site_settings.key so the admin UI and the
 * read-path both speak the same language. Using a map (rather than
 * string concat) keeps this list scannable and rename-refactor-safe.
 */
export const PAYMENT_METHOD_SETTING_KEYS: Record<PaymentMethodKey, string> = {
  card: "payment_card_enabled",
  zelle: "payment_zelle_enabled",
  crypto: "payment_crypto_enabled",
  paypal: "payment_paypal_enabled",
}

/**
 * Defaults for the toggle state. Card/Zelle/Crypto default ON so a
 * missing settings row never locks customers out of checkout for the
 * rails that were already live. PayPal defaults OFF because it's a
 * new rail the merchant has to consciously activate (and has env-var
 * prerequisites the other rails don't).
 */
export const DEFAULT_PAYMENT_TOGGLES: PaymentMethodToggles = {
  card: true,
  zelle: true,
  crypto: true,
  paypal: false,
}
