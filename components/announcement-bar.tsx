"use client"

import { useEffect, useState } from "react"
import { Truck, X } from "lucide-react"

/**
 * Compact site-wide promo strip displayed above the header nav.
 *
 * - Uses `sessionStorage` (not `localStorage`) so the bar reappears on the
 *   next visit — we still want new-session shoppers to see it, without
 *   annoying someone who just dismissed it seconds ago.
 * - Starts visible on the server to avoid a layout shift, then unmounts
 *   on mount if the session flag is set.
 */
const DISMISS_KEY = "pxm:announce-dismissed:v1"

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setVisible(false)
    } catch {
      // Private-mode / storage disabled — just keep it visible.
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Site announcement"
      className="w-full bg-foreground text-background text-xs sm:text-sm"
    >
      <div className="mx-auto max-w-7xl flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex-1 flex items-center justify-center gap-2 text-center">
          <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-80" aria-hidden="true" />
          <p className="font-medium tracking-tight">
            <span className="hidden sm:inline">
              Free US shipping on orders over{" "}
            </span>
            <span className="sm:hidden">Free US shipping over </span>
            <span className="text-accent font-semibold">$500</span>
            <span className="hidden sm:inline text-background/60">
              {" "}
              · Ships next business day
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            try {
              sessionStorage.setItem(DISMISS_KEY, "1")
            } catch {
              /* ignore */
            }
          }}
          className="shrink-0 -mr-1 p-1 rounded-md text-background/70 hover:text-background hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40 transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>
    </div>
  )
}
