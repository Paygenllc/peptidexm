"use client"

import { useEffect, useState } from "react"
import { Analytics } from "@vercel/analytics/next"
import { CONSENT_EVENT, getConsent } from "@/lib/consent"

/**
 * Mounts Vercel Analytics only when the shopper has explicitly
 * accepted cookies, and only in production. Replaces the previous
 * unconditional `<Analytics />` that sat in `app/layout.tsx`.
 *
 * We subscribe to the custom CONSENT_EVENT fired by the cookie
 * banner so a shopper who clicks "Accept" gets tracked starting on
 * their current page — no reload required. Similarly, if we later
 * add a "revoke consent" control, flipping the cookie back to
 * `rejected` will unmount Analytics immediately on the next event.
 *
 * Why this lives in its own component instead of the banner:
 * Analytics has to mount inside the root layout's body so it works
 * on every route, but the banner only exists at the bottom of the
 * layout. Separating the gate lets each piece live where it
 * semantically belongs without passing state through the tree.
 */
export function AnalyticsGate() {
  // We start with `allowed=false` so nothing is loaded during SSR or
  // the initial hydration pass. Revealing Analytics is always a
  // client-only decision; showing it conservatively does no harm.
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const sync = () => setAllowed(getConsent() === "accepted")
    sync()

    const onChange = () => sync()
    window.addEventListener(CONSENT_EVENT, onChange)

    // Cross-tab consistency: if the shopper updates consent in
    // another tab, the storage event fires for cookies that land
    // in localStorage too. We don't use localStorage, but browsers
    // also fire a `pageshow` on BFCache restore — wire that up so
    // back/forward navigation picks up the latest decision.
    window.addEventListener("pageshow", onChange)

    return () => {
      window.removeEventListener(CONSENT_EVENT, onChange)
      window.removeEventListener("pageshow", onChange)
    }
  }, [])

  if (!allowed) return null
  if (process.env.NODE_ENV !== "production") return null

  return <Analytics />
}
