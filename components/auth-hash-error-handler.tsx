"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Supabase's hosted auth service sometimes puts the result of an email
 * confirmation link (including errors) into the URL hash fragment, e.g.
 *   https://example.com/#error=access_denied&error_code=otp_expired&error_description=...
 *
 * Hash fragments are never sent to the server, so we handle them on the
 * client and redirect to our friendly error page.
 */
export function AuthHashErrorHandler() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash || !hash.includes("error")) return

    const params = new URLSearchParams(hash.replace(/^#/, ""))
    const description = params.get("error_description") || params.get("error") || "Authentication failed"

    // Clean the hash out of the URL before navigating away
    history.replaceState(null, "", window.location.pathname + window.location.search)
    router.replace(`/auth/error?message=${encodeURIComponent(description)}`)
  }, [router])

  return null
}
