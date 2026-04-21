"use server"

import { createClient } from "@/lib/supabase/server"
// The write path must use the service-role client. `site_settings` has
// RLS enabled with only a SELECT policy (so any anon/authenticated
// reader can list the flags) — INSERT/UPDATE are blocked for regular
// sessions. `requireAdmin()` below already gates the action itself,
// so using service-role for the write is safe and matches the pattern
// used by every other admin action in this folder.
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import {
  PAYMENT_METHOD_SETTING_KEYS,
  type PaymentMethodKey,
} from "@/lib/payment-methods"

/**
 * Admin-only: flip a payment method on or off.
 *
 * Persists to public.site_settings and revalidates the two pages that
 * render the toggle state (admin settings + customer checkout). The
 * setting key is derived from an allow-listed `PaymentMethodKey` so
 * callers can't sneak arbitrary keys into site_settings via this
 * endpoint.
 *
 * Guard rail: we do NOT prevent the admin from disabling all three
 * methods at once. The checkout page shows an explicit "payments are
 * currently unavailable" state when every rail is off, which is the
 * right UX for planned maintenance. The admin page surfaces a warning
 * banner in that case so it isn't accidental.
 */
export async function setPaymentMethodEnabledAction(input: {
  method: PaymentMethodKey
  enabled: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  const { method, enabled } = input
  const settingKey = PAYMENT_METHOD_SETTING_KEYS[method]
  if (!settingKey) {
    return { ok: false, error: "Unknown payment method." }
  }

  try {
    // Grab the current admin's user id from the session client purely
    // for the `updated_by` audit column. The actual upsert goes
    // through the service-role admin client so RLS can't silently
    // block the write.
    const sessionClient = await createClient()
    const { data: authUser } = await sessionClient.auth.getUser()

    const admin = createAdminClient()

    // Upsert the row with the new boolean + bump the audit timestamp.
    // We use to_jsonb semantics implicitly — the jsonb column accepts
    // native JSON booleans on insert/update from the JS client.
    const { error } = await admin.from("site_settings").upsert(
      {
        key: settingKey,
        value: enabled,
        updated_at: new Date().toISOString(),
        updated_by: authUser?.user?.id ?? null,
      },
      { onConflict: "key" },
    )

    if (error) {
      console.error("[v0] setPaymentMethodEnabledAction error:", error.message)
      return { ok: false, error: error.message }
    }

    // Refresh anything that renders toggle state.
    revalidatePath("/admin/settings/payments")
    revalidatePath("/checkout")

    return { ok: true }
  } catch (err) {
    console.error("[v0] setPaymentMethodEnabledAction threw:", err)
    return { ok: false, error: "Could not update payment setting." }
  }
}
