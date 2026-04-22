/**
 * Carrier detection + tracking URL construction.
 *
 * Admins paste tracking numbers into the order detail page — sometimes
 * with a carrier, sometimes without, sometimes with a full tracking URL
 * already filled in. This module normalizes all three cases into a
 * single { label, trackingUrl } pair we can render on the customer
 * dashboard without extra conditionals at the call site.
 *
 * Detection is a best-effort regex match against well-known formats
 * (USPS Priority/Express, UPS 1Z, FedEx 12/15-digit, DHL 10-digit).
 * If no carrier explicitly set AND no format match, we return
 * `"other"` and omit the tracking URL — the UI falls back to showing
 * the number as plain text instead of linking to a wrong site.
 */

export type Carrier = "usps" | "ups" | "fedex" | "dhl" | "other"

export interface CarrierInfo {
  /** Normalized carrier key */
  carrier: Carrier
  /** Human-readable label for the UI ("USPS", "UPS", "FedEx", …) */
  label: string
  /**
   * Deep link to the carrier's web tracker, pre-populated with the
   * tracking number. Null when we can't confidently pick one (the
   * UI should show the number as plain text in that case).
   */
  trackingUrl: string | null
}

const CARRIER_LABELS: Record<Carrier, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL",
  other: "Carrier",
}

/**
 * Best-effort carrier detection from a raw tracking number.
 * We intentionally only match high-confidence formats — if a format
 * could plausibly belong to multiple carriers we return "other"
 * rather than guess wrong and deep-link to the wrong tracker.
 */
export function detectCarrier(trackingNumber: string): Carrier {
  // Strip whitespace + hyphens that admins sometimes paste in from
  // carrier-generated labels ("9400 1000 0000 …" or "1Z-999-…").
  const n = trackingNumber.replace(/[\s-]/g, "").toUpperCase()

  // UPS: always begins with "1Z", followed by exactly 16 alphanumerics
  // (18 chars total). Very distinctive — no other carrier uses this.
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return "ups"

  // USPS Priority/Express: 20-22 digit numeric. Covers 91-/94-/92-/93-
  // prefixed labels.
  if (/^9[1-5]\d{18,20}$/.test(n)) return "usps"

  // USPS International (Registered, Priority International, etc):
  // 2 letters + 9 digits + "US" (13 chars total).
  if (/^[A-Z]{2}\d{9}US$/.test(n)) return "usps"

  // FedEx Ground/Express: 12- or 15-digit numeric. (20-digit is also
  // valid for SmartPost, but 20 digits overlaps with USPS — so we
  // leave it ambiguous rather than misroute.)
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n)) return "fedex"

  // DHL Express: 10-digit numeric, or starts with "JVGL" / "JJD".
  if (/^\d{10}$/.test(n) || /^JVGL\d+$/.test(n) || /^JJD\d+$/.test(n)) return "dhl"

  return "other"
}

/**
 * Build a tracking deep link for a known carrier. Returns null for
 * "other" so the UI can degrade gracefully to plain text.
 */
function buildTrackingUrl(carrier: Carrier, trackingNumber: string): string | null {
  const n = encodeURIComponent(trackingNumber.replace(/[\s-]/g, ""))
  switch (carrier) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
    case "ups":
      return `https://www.ups.com/track?tracknum=${n}`
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`
    case "dhl":
      return `https://www.dhl.com/en/express/tracking.html?AWB=${n}`
    default:
      return null
  }
}

/**
 * Main entry point — takes whatever the DB has (number, optional
 * admin-supplied carrier hint, optional full URL override) and
 * returns a normalized { label, trackingUrl } pair ready for the UI.
 *
 * Precedence:
 *   1. Admin-supplied `trackingUrl` wins if it's a plausible URL —
 *      handles custom carriers (USPS regional, international post,
 *      freight forwarders) without needing a code change.
 *   2. Admin-supplied `carrierHint` is trusted over detection.
 *   3. Detected carrier from the number format.
 *   4. "other" fallback — label + plain number, no link.
 */
export function resolveCarrierInfo(
  trackingNumber: string | null | undefined,
  carrierHint?: string | null,
  trackingUrl?: string | null,
): CarrierInfo | null {
  if (!trackingNumber || !trackingNumber.trim()) return null

  // Admin-provided URL always wins. Validate it at least looks like
  // a URL so a typo doesn't become a broken link.
  const urlFromAdmin =
    trackingUrl && /^https?:\/\//i.test(trackingUrl.trim()) ? trackingUrl.trim() : null

  const hint = (carrierHint || "").toLowerCase().trim()
  const normalizedHint: Carrier =
    hint === "usps" || hint === "ups" || hint === "fedex" || hint === "dhl"
      ? (hint as Carrier)
      : "other"

  const carrier = normalizedHint !== "other" ? normalizedHint : detectCarrier(trackingNumber)

  return {
    carrier,
    label: CARRIER_LABELS[carrier],
    trackingUrl: urlFromAdmin ?? buildTrackingUrl(carrier, trackingNumber),
  }
}
