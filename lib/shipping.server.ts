import "server-only"

import { createClient } from "@/lib/supabase/server"

/**
 * Key in `public.site_settings` that stores the global free-shipping
 * override boolean. Seeded by scripts/021_free_shipping_override.sql.
 */
export const FREE_SHIPPING_SETTING_KEY = "shipping_free_all_enabled" as const

/**
 * Server-only reader for the "free shipping for all orders" override
 * flag. Mirrors `lib/payment-methods.server.ts` so both settings share
 * one pattern.
 *
 * Fails CLOSED (returns `false`) on any error: if the DB is
 * unreachable or the row is missing, we charge normal shipping
 * rather than accidentally giving every shopper free shipping for
 * the duration of an outage. That's the inverse of the
 * payment-methods reader (which fails open) because the worst case
 * here is revenue loss, not a broken checkout.
 *
 * Safe to call from server components and server actions.
 */
export async function getFreeShippingEnabled(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", FREE_SHIPPING_SETTING_KEY)
      .maybeSingle()

    if (error) {
      console.error(
        "[v0] getFreeShippingEnabled read error:",
        error.message,
      )
      return false
    }
    // jsonb column seeded as `to_jsonb(false)` comes back as native bool.
    return data?.value === true
  } catch (err) {
    console.error("[v0] getFreeShippingEnabled threw:", err)
    return false
  }
}
