import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Card processor identity. Only one is ever active at a time — toggled
 * from /admin/settings/payments. We keep the union narrow so a typo
 * in a server file is a compile error rather than a runtime fallback.
 */
export type CardProcessor = "squadco" | "stryd"

export const DEFAULT_CARD_PROCESSOR: CardProcessor = "squadco"
export const CARD_PROCESSOR_SETTING_KEY = "card_processor"

/**
 * Resolve the active card processor from site_settings. Used by:
 *
 *   - app/actions/card-payment.ts (the runtime dispatcher that decides
 *     which provider's checkout-link generator to call)
 *   - the admin payments page (so the form hydrates with the saved
 *     value)
 *
 * Resilient by design: any read failure or unexpected value falls back
 * to `DEFAULT_CARD_PROCESSOR` so a corrupt setting can never block a
 * checkout. The default mirrors what was active before this knob
 * existed (Squadco), which keeps existing tenants on the same rail
 * after the migration runs.
 */
export async function getActiveCardProcessor(): Promise<CardProcessor> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", CARD_PROCESSOR_SETTING_KEY)
      .maybeSingle()

    // site_settings.value is jsonb. We stored the processor as a JSON
    // string (e.g. `"stryd"`), so the parsed shape is `string | null`.
    const v = data?.value
    if (v === "stryd" || v === "squadco") return v
    return DEFAULT_CARD_PROCESSOR
  } catch (err) {
    console.error("[v0] getActiveCardProcessor failed, defaulting:", err)
    return DEFAULT_CARD_PROCESSOR
  }
}
