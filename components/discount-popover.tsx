"use client"

import { useEffect, useState } from "react"
import { Tag, X } from "lucide-react"
import { NewsletterForm } from "@/components/newsletter-form"

/**
 * Floating "GET 10% OFF" button + popover-form.
 *
 * Anchored bottom-left so it never collides with the ChatBubble (which
 * lives bottom-right). The button pulses gently on first paint to draw
 * the eye but stops after one cycle so it doesn't become a distraction
 * on long sessions.
 *
 * Two pieces of localStorage state govern visibility:
 *
 *   `pxm_discount_dismissed = "1"`  — visitor clicked the X. Hide for
 *                                     30 days, then show again.
 *   `pxm_discount_subscribed = "1"` — they completed the subscribe
 *                                     flow. Hide forever (until they
 *                                     manually clear cookies/storage).
 *
 * Mounting this on `/` only is intentional — the discount lives on the
 * marketing surface, not on legal/admin/checkout routes where it would
 * create friction.
 */
const DISMISS_KEY = "pxm_discount_dismissed_at"
const SUBSCRIBED_KEY = "pxm_discount_subscribed"
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function DiscountPopover() {
  // `mounted` keeps SSR markup deterministic — we only decide whether
  // to render after we can read localStorage on the client.
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (window.localStorage.getItem(SUBSCRIBED_KEY) === "1") {
        setHidden(true)
        return
      }
      const dismissedAt = window.localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ts = Number.parseInt(dismissedAt, 10)
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setHidden(true)
        }
      }
    } catch {
      // localStorage may be unavailable (private mode, embedded
      // browsers). Failing open just means the button shows — that's
      // the right default for a marketing offer.
    }
  }, [])

  // Esc-to-close while the panel is open. Same pattern as ChatBubble
  // so the two floating surfaces feel cohesive.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  // Watch for the subscribe form's success state. The NewsletterForm
  // doesn't expose a callback, but the server action causes its
  // internal state to flip and the form re-renders a "Subscribed"
  // pill. We listen for the visible success text via a MutationObserver
  // on the panel — cheaper than threading a prop through, and resilient
  // if the form's internal markup changes.
  //
  // (We could also set the localStorage flag from inside NewsletterForm,
  // but doing it here keeps that component generic for the footer use.)
  useEffect(() => {
    if (!open) return
    const panel = document.getElementById("pxm-discount-panel")
    if (!panel) return
    const observer = new MutationObserver(() => {
      // The form renders a paragraph containing "Thanks for subscribing"
      // when the action returns success — that's our trigger.
      if (panel.textContent?.includes("Thanks for subscribing")) {
        try {
          window.localStorage.setItem(SUBSCRIBED_KEY, "1")
        } catch {
          /* ignore */
        }
        // Auto-close shortly after success so the visitor can keep
        // shopping. Long enough to read the confirmation.
        const t = window.setTimeout(() => {
          setOpen(false)
          setHidden(true)
        }, 2000)
        return () => window.clearTimeout(t)
      }
    })
    observer.observe(panel, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [open])

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setOpen(false)
    setHidden(true)
  }

  if (!mounted || hidden) return null

  return (
    <>
      {/* Trigger — pill-shaped, brand-colored, bottom-left so it
        * never collides with the ChatBubble in the bottom-right. The
        * `discount-pulse` keyframe runs once on mount via the
        * inline style/className combination below. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close discount offer" : "Open discount offer"}
        aria-expanded={open}
        aria-controls="pxm-discount-panel"
        className="fixed z-40 bottom-4 left-4 sm:bottom-6 sm:left-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground pl-3 pr-4 h-12 shadow-lg shadow-foreground/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all font-medium text-sm discount-pulse"
      >
        <Tag className="h-4 w-4" aria-hidden="true" />
        <span>GET 10% OFF</span>
      </button>

      {/* Popover panel. Slides up from bottom-left. We render
        * unconditionally and toggle visibility through classes so the
        * transition runs both directions, matching the ChatBubble
        * pattern for visual consistency. */}
      <div
        id="pxm-discount-panel"
        role="dialog"
        aria-modal="false"
        aria-label="Get 10% off your first order"
        aria-hidden={!open}
        className={`fixed z-40 bottom-20 left-4 sm:bottom-24 sm:left-6 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-background border border-border shadow-2xl shadow-foreground/20 transition-all duration-200 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              First-order offer
            </div>
            <h2 className="font-serif text-lg leading-tight text-balance">
              10% off your first order
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Subscribe to our journal — we&apos;ll email your code and the
              occasional research note. No marketing spam.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss discount offer"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4">
          <NewsletterForm source="home_floating_promo" />
        </div>

        <p className="px-5 pb-4 text-[11px] text-muted-foreground leading-relaxed">
          One-click unsubscribe in every email. We never share your address.
        </p>
      </div>

      {/* One-shot pulse keyframe. Scoped via component-prefixed class
        * name so it doesn't conflict with anything else and runs only
        * a couple of times on mount — endlessly pulsing CTAs are an
        * accessibility/anxiety problem, not a conversion win. */}
      <style jsx>{`
        @keyframes discountPulse {
          0%,
          100% {
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.18);
          }
          50% {
            box-shadow:
              0 10px 24px -4px rgba(0, 0, 0, 0.22),
              0 0 0 6px hsl(var(--primary) / 0.18);
          }
        }
        .discount-pulse {
          animation: discountPulse 2.4s ease-in-out 0.6s 2;
        }
        @media (prefers-reduced-motion: reduce) {
          .discount-pulse {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
