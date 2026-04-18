"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/**
 * Handles the implicit-flow hash fragment that Supabase appends when the
 * email template uses `{{ .ConfirmationURL }}`. The hash never reaches the
 * server, so we read it here and establish the session before redirecting
 * to `next`.
 */
export function AuthConfirmClient({ next }: { next: string }) {
  const [status, setStatus] = useState<"working" | "error">("working")

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
      const hashParams = new URLSearchParams(hash)

      const errorDescription = hashParams.get("error_description")
      if (errorDescription) {
        const clean = errorDescription.replace(/\+/g, " ")
        window.location.replace(`/auth/error?message=${encodeURIComponent(clean)}`)
        return
      }

      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")

      if (!accessToken || !refreshToken) {
        window.location.replace(
          `/auth/error?message=${encodeURIComponent(
            "Missing confirmation token. The link may have been opened in a different browser or was already used.",
          )}`,
        )
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (cancelled) return

      if (error) {
        window.location.replace(`/auth/error?message=${encodeURIComponent(error.message)}`)
        return
      }

      // Strip the hash and navigate to the intended destination.
      window.location.replace(next)
    }

    run().catch((err) => {
      if (cancelled) return
      console.error("[v0] auth/confirm client error", err)
      setStatus("error")
    })

    return () => {
      cancelled = true
    }
  }, [next])

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {status === "working" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Verifying your link&hellip;</span>
          </>
        ) : (
          <span>Something went wrong. Please request a new link.</span>
        )}
      </div>
    </div>
  )
}
