"use client"

import { useEffect } from "react"

/**
 * Fires a single POST to /api/blog/view/[slug] per pageview, but dedupes
 * within a short window so reloads or back/forward navigation don't inflate
 * the count. Admins are filtered out server-side, so this component just
 * has to worry about being cheap and robust.
 *
 * We POST via keepalive so the count reliably lands even if the user hits
 * another link immediately after the page becomes interactive.
 */
export function BlogViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return
    const key = `pxm_blog_seen_${slug}`
    try {
      // Dedupe within the same browser tab — guards against React strict-mode
      // double-effects in dev and rapid back/forward navigations.
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1")
    } catch {
      // Private mode or quota issues — still fire the beacon.
    }

    const ctrl = new AbortController()
    fetch(`/api/blog/view/${encodeURIComponent(slug)}`, {
      method: "POST",
      keepalive: true,
      signal: ctrl.signal,
    }).catch(() => {
      // Swallow — this is best-effort analytics, not a real request.
    })
    return () => ctrl.abort()
  }, [slug])

  return null
}
