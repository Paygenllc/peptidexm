"use client"

import { useEffect } from "react"

/**
 * First-touch attribution capture.
 *
 * On the very first page load of a browser session we stash the referrer,
 * landing path, and any UTM params into a `pxm_attr` cookie. Every later
 * pageview leaves that cookie alone — so even if the shopper navigates
 * internally before reaching checkout, we still know HOW they originally
 * arrived on the site. `place-order.ts` reads this cookie and persists the
 * values on the order row.
 *
 * Uses a 30-day cookie so repeat visitors within the same month are still
 * attributed to their original source. Longer attribution windows aren't
 * useful for a supplier whose purchase cycle is measured in weeks.
 */
const COOKIE_NAME = "pxm_attr"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

type Attribution = {
  referrer: string
  landing_path: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  ts: number
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const target = `${name}=`
  const chunks = document.cookie.split(";")
  for (const raw of chunks) {
    const chunk = raw.trim()
    if (chunk.startsWith(target)) return decodeURIComponent(chunk.substring(target.length))
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return
  // `Secure` is implicit in production (HTTPS-only site) but the attribute
  // is harmless on http://localhost and keeps the cookie valid there too.
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ]
  if (typeof window !== "undefined" && window.location.protocol === "https:") parts.push("Secure")
  document.cookie = parts.join("; ")
}

export function AttributionBeacon() {
  useEffect(() => {
    try {
      // Preserve first-touch. If we already have attribution, don't overwrite.
      if (readCookie(COOKIE_NAME)) return

      const url = new URL(window.location.href)
      const params = url.searchParams

      const payload: Attribution = {
        referrer: document.referrer || "",
        landing_path: url.pathname + url.search,
        utm_source: params.get("utm_source") ?? undefined,
        utm_medium: params.get("utm_medium") ?? undefined,
        utm_campaign: params.get("utm_campaign") ?? undefined,
        utm_term: params.get("utm_term") ?? undefined,
        utm_content: params.get("utm_content") ?? undefined,
        ts: Date.now(),
      }

      writeCookie(COOKIE_NAME, JSON.stringify(payload), MAX_AGE_SECONDS)
    } catch (err) {
      // Never let a tracking failure break the page.
      console.log("[v0] attribution beacon failed", err)
    }
  }, [])

  return null
}
