/**
 * Shared client-side helpers for the two first-run cookies that
 * block access to the site until the shopper interacts with them:
 *
 *   - `pxm_age_ok=1`         — set after the age gate is accepted.
 *                              Lives for 30 days so repeat visits
 *                              within a month don't re-prompt.
 *   - `pxm_cookie_consent`   — `accepted` | `rejected`, controls
 *                              whether non-essential tracking
 *                              (Vercel Analytics) mounts. 365-day
 *                              lifespan because that's the
 *                              regulator-friendly default for
 *                              consent persistence.
 *
 * The functions below deliberately mirror the attribute style used
 * by `components/attribution-beacon.tsx` — Path=/, SameSite=Lax,
 * Secure on HTTPS — so every first-party cookie this site sets
 * looks identical in DevTools. That consistency matters for privacy
 * reviews and for anyone debugging a cookie-related issue later.
 */

export const AGE_COOKIE = "pxm_age_ok"
export const CONSENT_COOKIE = "pxm_cookie_consent"

// 30 days for age, 365 for consent. See file-header comment.
export const AGE_MAX_AGE = 60 * 60 * 24 * 30
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365

// Custom DOM event the banner fires when the shopper picks a choice.
// The Analytics gate listens for this so it can mount/unmount
// `@vercel/analytics` without a full page reload.
export const CONSENT_EVENT = "pxm:consent-changed"

export type ConsentValue = "accepted" | "rejected"

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const target = `${name}=`
  for (const raw of document.cookie.split(";")) {
    const chunk = raw.trim()
    if (chunk.startsWith(target)) {
      return decodeURIComponent(chunk.substring(target.length))
    }
  }
  return null
}

export function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ]
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure")
  }
  document.cookie = parts.join("; ")
}

export function hasAgeAck(): boolean {
  return readCookie(AGE_COOKIE) === "1"
}

export function getConsent(): ConsentValue | null {
  const raw = readCookie(CONSENT_COOKIE)
  return raw === "accepted" || raw === "rejected" ? raw : null
}

export function setConsent(value: ConsentValue) {
  writeCookie(CONSENT_COOKIE, value, CONSENT_MAX_AGE)
  // Notify any in-page listeners (e.g. the Analytics gate) so they
  // can react immediately rather than waiting for the next mount.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
  }
}

export function acceptAge() {
  writeCookie(AGE_COOKIE, "1", AGE_MAX_AGE)
}
