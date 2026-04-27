import "server-only"
import { createClient } from "@/lib/supabase/server"

/**
 * Shape of the `chat_business_hours` row in `site_settings.value`.
 * Seeded by scripts/045_chat_messages.sql. Editable via SQL today;
 * a UI editor can be layered on later without changing this shape.
 *
 *   enabled   — when false the bubble treats the site as ALWAYS-online
 *               (i.e. the form just collects the message; no "we're
 *               offline" copy). Useful for businesses with 24/7
 *               coverage that still want to use the bubble.
 *   timezone  — IANA zone (e.g. "America/New_York"). The hours are
 *               interpreted in this zone, NOT the user's local zone,
 *               so customers in any timezone see consistent state.
 *   start/end — "HH:MM" 24-hour strings. End is exclusive (17:00 means
 *               we go offline at 5:00 pm sharp).
 *   days      — JS-style weekday numbers (0 = Sunday … 6 = Saturday).
 *               Default seed is [1,2,3,4,5] for Mon–Fri.
 */
export type ChatBusinessHours = {
  enabled: boolean
  timezone: string
  start: string
  end: string
  days: number[]
}

const DEFAULTS: ChatBusinessHours = {
  enabled: true,
  timezone: "America/New_York",
  start: "09:00",
  end: "17:00",
  days: [1, 2, 3, 4, 5],
}

/**
 * Cache the row for the lifetime of one request. The bubble polls
 * /api/chat/availability on mount, so within a single page render
 * we don't want to round-trip to Postgres more than once. We do
 * NOT cache across requests because the admin can change hours at
 * any time and we want the next visitor to see the new state
 * without a deploy.
 */
async function readHours(): Promise<ChatBusinessHours> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "chat_business_hours")
      .maybeSingle()

    if (error || !data?.value) return DEFAULTS

    // The jsonb column comes back as `unknown` — narrow it carefully
    // and fall back to defaults for any field that's missing or
    // malformed rather than crashing the bubble.
    const raw = data.value as Partial<ChatBusinessHours>
    return {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled,
      timezone: typeof raw.timezone === "string" ? raw.timezone : DEFAULTS.timezone,
      start: typeof raw.start === "string" ? raw.start : DEFAULTS.start,
      end: typeof raw.end === "string" ? raw.end : DEFAULTS.end,
      days: Array.isArray(raw.days) ? raw.days.filter((n): n is number => typeof n === "number") : DEFAULTS.days,
    }
  } catch (err) {
    console.error("[v0] readHours: failed to read chat_business_hours, using defaults", err)
    return DEFAULTS
  }
}

/**
 * Decide whether `now` falls inside the configured business window.
 *
 * The trick here is interpreting the configured "09:00" in the
 * configured timezone, not the server's UTC clock. We use
 * Intl.DateTimeFormat with `hour12: false` to extract the local
 * hour/minute/weekday in the target zone — that's the only zone-
 * correct way to do this without pulling in moment-timezone or luxon.
 */
function isOpenNow(hours: ChatBusinessHours, now: Date): boolean {
  if (!hours.enabled) return true // see DEFAULTS comment above

  // Build a single formatter once per call. We ask for hour, minute,
  // and weekday in one shot; reading them off `formatToParts` is
  // cheap and avoids three separate Intl roundtrips.
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: hours.timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(now)
  } catch {
    // Bad timezone string (admin typo'd it). Fail open: treat as
    // online so we don't accidentally block leads on a config error.
    return true
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const hour = parseInt(get("hour"), 10)
  const minute = parseInt(get("minute"), 10)
  const weekdayShort = get("weekday") // "Mon", "Tue", ...

  if (Number.isNaN(hour) || Number.isNaN(minute)) return true

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const weekday = weekdayMap[weekdayShort] ?? -1
  if (!hours.days.includes(weekday)) return false

  const minutesNow = hour * 60 + minute
  const [sH, sM] = hours.start.split(":").map((n) => parseInt(n, 10))
  const [eH, eM] = hours.end.split(":").map((n) => parseInt(n, 10))
  if ([sH, sM, eH, eM].some(Number.isNaN)) return true

  const startMin = sH * 60 + sM
  const endMin = eH * 60 + eM
  return minutesNow >= startMin && minutesNow < endMin
}

/**
 * Format the configured window as a short, human-readable string the
 * bubble can show in its offline state ("We're back Mon–Fri, 9 AM –
 * 5 PM ET"). Day-list rendering tries to collapse contiguous runs
 * (Mon–Fri) and falls back to a comma list for non-contiguous sets
 * (e.g. weekends only).
 */
function formatHoursLabel(h: ChatBusinessHours): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const days = [...h.days].sort((a, b) => a - b)
  let dayLabel = days.map((d) => dayNames[d]).join(", ")

  // Collapse a sorted run [1,2,3,4,5] -> "Mon-Fri"
  const isContiguous =
    days.length >= 2 && days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  if (isContiguous) {
    dayLabel = `${dayNames[days[0]]}-${dayNames[days[days.length - 1]]}`
  }

  const fmt = (s: string) => {
    const [hh, mm] = s.split(":").map((n) => parseInt(n, 10))
    const period = hh >= 12 ? "PM" : "AM"
    const h12 = ((hh + 11) % 12) + 1
    return mm === 0 ? `${h12} ${period}` : `${h12}:${String(mm).padStart(2, "0")} ${period}`
  }

  // Strip "America/" or other prefixes for readability ("New York" >
  // "America/New_York"). Replace underscores with spaces.
  const tzShort = h.timezone.split("/").pop()?.replace(/_/g, " ") ?? h.timezone

  return `${dayLabel}, ${fmt(h.start)} – ${fmt(h.end)} ${tzShort}`
}

export type ChatAvailability = {
  open: boolean
  hoursLabel: string
}

/**
 * Public API consumed by both the /api route (for the bubble) and the
 * server action (for tagging submitted_when on the row).
 */
export async function getChatAvailability(): Promise<ChatAvailability> {
  const hours = await readHours()
  const open = isOpenNow(hours, new Date())
  return { open, hoursLabel: formatHoursLabel(hours) }
}
