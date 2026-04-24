"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Cookie, X } from "lucide-react"
import {
  AGE_COOKIE,
  CONSENT_EVENT,
  getConsent,
  hasAgeAck,
  readCookie,
  setConsent,
} from "@/lib/consent"

/**
 * Fixed-bottom cookie consent banner.
 *
 * Shown only after the age gate has been acknowledged (we don't want
 * to stack two compliance surfaces at once — the shopper gets the
 * harder decision first). Once a choice is made it's persisted in a
 * 365-day cookie, and we fire a CONSENT_EVENT so the AnalyticsGate
 * component can mount or unmount Vercel Analytics without a reload.
 *
 * Design choices:
 *
 * - The banner is non-blocking — the shopper can keep browsing while
 *   deciding. This is the pattern that measures best for opt-in rates
 *   and also the pattern regulators prefer (no dark-pattern pressure).
 *
 * - "Reject" writes an explicit `rejected` cookie rather than doing
 *   nothing. That prevents us from re-prompting on every page and
 *   gives us an auditable record of the decision.
 *
 * - Polls for the age-ack cookie briefly on mount. The age gate sets
 *   it synchronously, but the banner mounts at the same time as the
 *   age dialog, so the first useEffect pass may run before the cookie
 *   exists. A 500ms window-ed listener handles the happy path without
 *   adding a global state store.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Decide whether to show. Three cases:
    //   1. Age not yet acked — stay hidden for now; we'll re-check
    //      on the next storage/consent event.
    //   2. Age acked and consent already recorded — stay hidden.
    //   3. Age acked and no consent yet — show.
    const evaluate = () => {
      if (!hasAgeAck()) {
        setVisible(false)
        return
      }
      setVisible(getConsent() === null)
    }

    evaluate()

    // Age dialog sets its cookie via document.cookie, which does NOT
    // fire a storage event. We poll at a very low cadence for a short
    // window after mount so the banner slides in right after the age
    // gate closes, without burning any CPU long-term.
    const start = Date.now()
    const interval = setInterval(() => {
      if (readCookie(AGE_COOKIE) === "1") {
        evaluate()
        clearInterval(interval)
      } else if (Date.now() - start > 60_000) {
        // Shopper never interacted with the age gate within a minute.
        // Stop polling; the next navigation will re-trigger evaluate().
        clearInterval(interval)
      }
    }, 300)

    return () => clearInterval(interval)
  }, [])

  if (!visible) return null

  const handleAccept = () => {
    setConsent("accepted")
    setVisible(false)
  }

  const handleReject = () => {
    setConsent("rejected")
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <div className="flex items-start gap-3 sm:flex-1">
          <Cookie
            className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            aria-hidden="true"
          />
          <div className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              We use cookies.
            </span>{" "}
            Essential cookies keep the site working. Analytics cookies help
            us understand how visitors use PeptideXM so we can improve it.{" "}
            <Link
              href="/privacy"
              className="font-medium text-foreground underline underline-offset-2 hover:text-accent"
            >
              Learn more
            </Link>
            .
          </div>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="flex-1 sm:flex-none"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="flex-1 sm:flex-none"
          >
            Accept
          </Button>
          {/* Close also counts as implicit reject — matches the
           * behavior of the "Reject" button so there's no dark-pattern
           * trap where the X leaves the banner in an ambiguous state. */}
          <button
            type="button"
            onClick={handleReject}
            aria-label="Dismiss cookie banner"
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:ml-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Re-export the event name as a no-op reference just so tree-shakers
// don't complain when this file is imported purely for its side effect
// in the root layout. No actual behavior hinges on it.
export { CONSENT_EVENT }
