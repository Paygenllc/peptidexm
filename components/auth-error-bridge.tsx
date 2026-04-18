"use client"

import { useEffect } from "react"

/**
 * When Supabase rejects a confirmation / reset link, it redirects to the
 * project's Site URL with the error encoded in the URL **hash fragment**
 * (e.g. `#error=access_denied&error_code=otp_expired&error_description=...`).
 * The hash never reaches the server, so we catch it client-side on mount
 * and route the user to our friendly /auth/error page.
 */
export function AuthErrorBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    const query = window.location.search.startsWith("?") ? window.location.search.slice(1) : ""

    const hashParams = new URLSearchParams(hash)
    const queryParams = new URLSearchParams(query)

    const error = hashParams.get("error") || queryParams.get("error")
    if (!error) return

    const errorCode = hashParams.get("error_code") || queryParams.get("error_code") || ""
    const rawDescription =
      hashParams.get("error_description") || queryParams.get("error_description") || ""
    // Supabase URL-encodes spaces as "+" — decode so we display it cleanly.
    const description = rawDescription.replace(/\+/g, " ")

    const target = new URL("/auth/error", window.location.origin)
    if (description) target.searchParams.set("message", description)
    if (errorCode) target.searchParams.set("code", errorCode)

    window.location.replace(target.toString())
  }, [])

  return null
}
