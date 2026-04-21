/**
 * Traffic-source classification.
 *
 * Given a referrer URL + the page's own origin + any UTM params, decide a
 * single `source_channel` label that's useful for analytics: direct, organic,
 * paid, social, email, referral, internal, or unknown.
 *
 * Kept intentionally compact — this is not GA4. We cover the cases that
 * actually matter for a small e-commerce site:
 *   - Known search engines → "organic"
 *   - utm_medium=cpc/paid/ads/ppc → "paid"
 *   - utm_source=email or utm_medium=email → "email"
 *   - Known social hosts or utm_medium=social → "social"
 *   - Same-origin referrer (or missing) → "direct" / "internal"
 *   - Anything else with an external referrer → "referral"
 */

export type SourceChannel =
  | "direct"
  | "organic"
  | "paid"
  | "social"
  | "email"
  | "referral"
  | "internal"
  | "unknown"

export interface AttributionPayload {
  referrer?: string | null
  landing_path?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
}

/**
 * Hostnames we treat as organic search. We match by suffix so "www.google.com",
 * "news.google.com", and locale variants ("google.co.uk", "google.de") all
 * classify the same way.
 */
const SEARCH_HOSTS = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "yandex.",
  "baidu.com",
  "ecosia.org",
  "brave.com",
  "qwant.com",
  "kagi.com",
  "startpage.com",
]

const SOCIAL_HOSTS = [
  "facebook.com",
  "m.facebook.com",
  "l.facebook.com",
  "instagram.com",
  "t.co",
  "twitter.com",
  "x.com",
  "reddit.com",
  "old.reddit.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "lnkd.in",
  "pinterest.com",
  "snapchat.com",
  "threads.net",
  "bsky.app",
  "discord.com",
  "t.me",
  "telegram.org",
  "whatsapp.com",
]

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paidsearch",
  "paid",
  "ads",
  "display",
  "banner",
  "affiliate",
  "retargeting",
])

function hostMatchesSuffix(host: string, needles: string[]): boolean {
  const lower = host.toLowerCase()
  return needles.some((n) => lower === n || lower.endsWith(`.${n}`) || lower.includes(n))
}

function safeUrl(value: string | null | undefined): URL | null {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

/**
 * Classify a visit into one `source_channel`. `siteHost` is the bare host of
 * the site itself ("www.peptidexm.com") and is used to tell apart internal
 * navigation from true direct hits.
 */
export function classifySource(
  payload: AttributionPayload,
  siteHost: string | null,
): SourceChannel {
  const medium = (payload.utm_medium || "").trim().toLowerCase()
  const source = (payload.utm_source || "").trim().toLowerCase()

  // UTM takes precedence over referrer — if someone explicitly tagged the
  // link, that's the truth.
  if (medium === "email" || source === "email" || source === "newsletter") return "email"
  if (medium === "social" || SOCIAL_HOSTS.some((h) => source.includes(h))) return "social"
  if (PAID_MEDIUMS.has(medium)) return "paid"
  if (medium === "organic") return "organic"
  if (medium === "referral") return "referral"

  const ref = safeUrl(payload.referrer)
  if (!ref) return "direct"

  const refHost = ref.host.toLowerCase()
  if (siteHost && (refHost === siteHost || refHost.endsWith(`.${siteHost}`))) {
    // Same-host referrer means they bounced between pages on our own site.
    return "internal"
  }

  if (hostMatchesSuffix(refHost, SEARCH_HOSTS)) return "organic"
  if (hostMatchesSuffix(refHost, SOCIAL_HOSTS)) return "social"

  return "referral"
}

/**
 * Human-friendly label for display — e.g. "Organic search" rather than the
 * raw `organic` enum. Keeps admin UI consistent.
 */
export function sourceLabel(channel: SourceChannel): string {
  switch (channel) {
    case "direct":
      return "Direct"
    case "organic":
      return "Organic search"
    case "paid":
      return "Paid ads"
    case "social":
      return "Social"
    case "email":
      return "Email"
    case "referral":
      return "Referral"
    case "internal":
      return "Internal"
    default:
      return "Unknown"
  }
}
