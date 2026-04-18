"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

type Stage = "verifying" | "ready" | "expired" | "success"

export function ResetPasswordForm() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("verifying")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Establish the recovery session from whichever shape Supabase sent us.
  // We support three flows so the page works regardless of which email
  // template format is configured in the Supabase dashboard.
  useEffect(() => {
    let cancelled = false

    async function establish() {
      const supabase = createClient()
      const url = new URL(window.location.href)

      // 1. Hash-fragment flow: #access_token=...&refresh_token=...&type=recovery
      //    (also carries #error=... when the token was pre-consumed)
      if (window.location.hash && window.location.hash.length > 1) {
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const errorCode = hash.get("error_code") || hash.get("error")

        if (errorCode) {
          console.log("[v0] reset-password hash error:", errorCode, hash.get("error_description"))
          history.replaceState(null, "", url.pathname + url.search)
          if (!cancelled) setStage("expired")
          return
        }

        const accessToken = hash.get("access_token")
        const refreshToken = hash.get("refresh_token")
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          // Strip the hash so tokens don't linger in browser history.
          history.replaceState(null, "", url.pathname + url.search)
          if (error) console.log("[v0] reset-password setSession error:", error.message)
          if (!cancelled) setStage(error ? "expired" : "ready")
          return
        }
      }

      // 2. Query token_hash flow: ?token_hash=...&type=recovery
      const tokenHash = url.searchParams.get("token_hash")
      const type = url.searchParams.get("type")
      if (tokenHash && (type === "recovery" || type === "email")) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "recovery" | "email",
          token_hash: tokenHash,
        })
        url.searchParams.delete("token_hash")
        url.searchParams.delete("type")
        url.searchParams.delete("next")
        const clean = url.searchParams.toString()
        history.replaceState(null, "", url.pathname + (clean ? `?${clean}` : ""))
        if (error) console.log("[v0] reset-password verifyOtp error:", error.message)
        if (!cancelled) setStage(error ? "expired" : "ready")
        return
      }

      // 3. PKCE code flow: ?code=...
      const code = url.searchParams.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        url.searchParams.delete("code")
        const clean = url.searchParams.toString()
        history.replaceState(null, "", url.pathname + (clean ? `?${clean}` : ""))
        if (error) console.log("[v0] reset-password exchangeCode error:", error.message)
        if (!cancelled) setStage(error ? "expired" : "ready")
        return
      }

      // 4. No token at all — maybe the user already verified and refreshed.
      const { data } = await supabase.auth.getUser()
      if (!cancelled) setStage(data.user ? "ready" : "expired")
    }

    establish().catch((err) => {
      console.log("[v0] reset-password establish threw:", err)
      if (!cancelled) setStage("expired")
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    setError(null)
    const password = String(formData.get("password") || "")
    const confirmPassword = String(formData.get("confirm_password") || "")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    startTransition(async () => {
      const supabase = createClient()

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setStage("expired")
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setStage("success")

      // Pick landing page based on admin flag, then force a server refresh so
      // RSC sees the fresh session cookie.
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single()

      setTimeout(() => {
        router.replace(profile?.is_admin ? "/admin" : "/account")
        router.refresh()
      }, 800)
    })
  }

  if (stage === "verifying") {
    return (
      <Card className="border-2">
        <CardContent className="p-6 sm:p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
        </CardContent>
      </Card>
    )
  }

  if (stage === "expired") {
    return (
      <Card className="border-2">
        <CardContent className="p-6 sm:p-8 text-center space-y-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mx-auto">
            <AlertCircle className="h-6 w-6 text-amber-700" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-medium mb-1">Link expired or already used</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Password reset links are single-use and expire after a short time. Some email apps pre-scan links and
              quietly invalidate them before you click. Request a new one and open it right away — in the same
              browser you&apos;re using now.
            </p>
          </div>
          <Button asChild className="w-full h-11">
            <Link href="/admin/forgot-password">Request a new link</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full h-10 text-muted-foreground">
            <Link href="/admin/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (stage === "success") {
    return (
      <Card className="border-2">
        <CardContent className="p-6 sm:p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" aria-hidden="true" />
          <p className="font-medium">Password updated. Redirecting…</p>
        </CardContent>
      </Card>
    )
  }

  // stage === "ready"
  return (
    <Card className="border-2">
      <CardContent className="p-6 sm:p-8">
        <form action={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
