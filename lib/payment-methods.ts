import { createClient } from "@/lib/supabase/server"

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

/**
 * Read the current payment method toggle state from site_settings.
 *
 * Fails OPEN: if the table read errors or a row is missing, we fall
 * back to `DEFAULT_PAYMENT_TOGGLES` rather than hiding every payment
 * method and breaking checkout for real customers. Hard failures are
 * logged so admins see them in the Vercel log stream.
 *
 * Safe to call from server components and server actions. Uses the
 * anon-session client because `site_settings` has a read-all RLS
 * policy (see scripts/020_site_settings.sql).
 */
export async function getPaymentMethodToggles(): Promise<PaymentMethodToggles> {
  try {
    const supabase = await createClient()
    const keys = Object.values(PAYMENT_METHOD_SETTING_KEYS)
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", keys)

    if (error) {
      console.error("[v0] getPaymentMethodToggles read error:", error.message)
      return { ...DEFAULT_PAYMENT_TOGGLES }
    }

    // Start from defaults (all true) and let DB rows override each one
    // individually. This way a missing row for any single key doesn't
    // knock the whole method offline.
    const toggles: PaymentMethodToggles = { ...DEFAULT_PAYMENT_TOGGLES }
    for (const row of data ?? []) {
      const methodKey = (Object.entries(PAYMENT_METHOD_SETTING_KEYS).find(
        ([, settingKey]) => settingKey === row.key,
      )?.[0] ?? null) as PaymentMethodKey | null
      if (!methodKey) continue
      // `value` is jsonb — we seeded it with to_jsonb(true/false), so
      // it comes back as a native boolean. Guard defensively anyway.
      toggles[methodKey] = row.value === true
    }
    return toggles
  } catch (err) {
    console.error("[v0] getPaymentMethodToggles threw:", err)
    return { ...DEFAULT_PAYMENT_TOGGLES }
  }
}
