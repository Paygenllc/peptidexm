"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import { CHAT_BUSINESS_HOURS_KEY } from "@/lib/chat-hours.server"

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const VALID_DAYS = new Set([0, 1, 2, 3, 4, 5, 6])

/**
 * Persist the business-hours config the chat bubble uses to decide
 * "online vs offline." We deliberately validate every field server
 * side rather than trusting the client form — the value lives in
 * jsonb, so a typo here would silently break availability detection.
 *
 * Rules enforced:
 *   - `enabled` must be a boolean.
 *   - `start` and `end` must match HH:MM (24h).
 *   - `end` must be strictly later than `start` (we don't model
 *     overnight schedules; the chat use-case is daytime support).
 *   - `days` must be a non-empty array of integers 0-6, where 0=Sun.
 *   - `timezone` must round-trip through Intl.DateTimeFormat — that
 *     catches typos like "America/NewYork" before they hit prod.
 */
export async function saveChatBusinessHoursAction(input: {
  enabled: boolean
  timezone: string
  start: string
  end: string
  days: number[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  if (typeof input.enabled !== "boolean") {
    return { ok: false, error: "Invalid 'enabled' value." }
  }
  if (!TIME_REGEX.test(input.start) || !TIME_REGEX.test(input.end)) {
    return { ok: false, error: "Times must be in HH:MM (24-hour) format." }
  }
  // Compare strings directly — "09:00" < "17:00" lexicographically
  // because both are zero-padded 24h.
  if (input.start >= input.end) {
    return { ok: false, error: "End time must be after the start time." }
  }
  if (!Array.isArray(input.days) || input.days.length === 0) {
    return { ok: false, error: "Pick at least one open day." }
  }
  if (!input.days.every((d) => Number.isInteger(d) && VALID_DAYS.has(d))) {
    return { ok: false, error: "Day values must be integers between 0 (Sun) and 6 (Sat)." }
  }
  try {
    // Validate the timezone by feeding it to Intl. An invalid TZ
    // throws a RangeError here.
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone })
  } catch {
    return { ok: false, error: `Unknown IANA timezone: "${input.timezone}".` }
  }

  // De-dupe + sort days so the persisted shape is canonical (helps
  // diffing in the database log).
  const normalizedDays = Array.from(new Set(input.days)).sort((a, b) => a - b)

  try {
    const sessionClient = await createClient()
    const { data: authUser } = await sessionClient.auth.getUser()

    const admin = createAdminClient()
    const { error } = await admin.from("site_settings").upsert(
      {
        key: CHAT_BUSINESS_HOURS_KEY,
        value: {
          enabled: input.enabled,
          timezone: input.timezone,
          start: input.start,
          end: input.end,
          days: normalizedDays,
        },
        updated_at: new Date().toISOString(),
        updated_by: authUser?.user?.id ?? null,
      },
      { onConflict: "key" },
    )
    if (error) {
      console.error("[v0] saveChatBusinessHoursAction error:", error.message)
      return { ok: false, error: error.message }
    }

    // Revalidate the settings page (the new state needs to render
    // back) and the root layout because the chat bubble's first call
    // to /api/chat/availability happens at open-time, not on every
    // render — but we still bust the layout cache to be safe.
    revalidatePath("/admin/settings/chat")
    revalidatePath("/", "layout")
    return { ok: true }
  } catch (err) {
    console.error("[v0] saveChatBusinessHoursAction threw:", err)
    return { ok: false, error: "Could not save chat hours." }
  }
}
