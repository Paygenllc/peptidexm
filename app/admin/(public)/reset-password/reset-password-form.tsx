"use client"

import { useState, useEffect, useRef, useTransition } from "react"
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
  // Stable supabase client — must not be recreated on every render or
  // the auth subscription below will be re-attached in a loop.
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()

  // Establish the recovery session from whichever shape Supabase sent us.
  //
  // The tricky part: @supabase/ssr's createBrowserClient has
  // detectSessionInUrl enabled by default. On construction it *asynchronously*
  // reads the URL hash, exchanges tokens, sets the session, and strips the
  // hash. That means if we try to read `window.location.hash` ourselves in a
  // useEffect, we race against Supabase's own handler — sometimes our read
  // sees the tokens, sometimes the hash is already empty, and in both cases
  // our follow-up `getUser()` returns null because auto-detect hasn't
  // finished yet. The user then sees "Link expired" even though the link was
  // perfectly valid.
  //
  // The fix is to listen for onAuthStateChange — it fires whenever a session
  // is established from *any* source (auto-detect included). We keep the
  // manual hash / token_hash / code paths only as fallbacks in case the user
  // arrives via an email template that bypasses auto-detect.
  useEffect(() => {
    const supabase = supabaseRef.current!
    let finished = false

    const settle = (next: Stage, reason: string) => {
      if (finished) return
      finished = true
      console.log("[v0] reset-password settle:", next, "-", reason)
      setStage(next)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[v0] reset-password authStateChange:", event, "hasSession:", !!session)
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        settle("ready", `authStateChange:${event}`)
      }
    })

    async function run() {
      // Early-exit if Supabase already gave us an error in the hash.
      if (typeof window !== "undefined" && window.location.hash.length > 1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const errCode = hashParams.get("error_code") || hashParams.get("error")
        if (errCode) {
          console.log("[v0] reset-password hash error:", errCode, hashParams.get("error_description"))
          history.replaceState(null, "", window.location.pathname + window.location.search)
          settle("expired", `hashError:${errCode}`)
          return
        }
      }

      // Give the browser client a beat to finish its own detectSessionInUrl
      // work. 150ms is generous — the listener will usually fire faster.
      await new Promise((r) => setTimeout(r, 150))
      if (finished) return

      // Manual hash path (in case auto-detect was disabled or failed).
      if (typeof window !== "undefined" && window.location.hash.length > 1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")
        if (accessToken && refreshToken) {
          console.log("[v0] reset-password manual setSession from hash")
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          history.replaceState(null, "", window.location.pathname + window.location.search)
          if (finished) return
          if (error) {
            console.log("[v0] reset-password setSession error:", error.message)
            settle("expired", `setSession:${error.message}`)
          }
          return // success path settled by listener
        }
      }

      // token_hash query flow (newer email templates).
      const url = new URL(window.location.href)
      const tokenHash = url.searchParams.get("token_hash")
      const type = url.searchParams.get("type")
      if (tokenHash && (type === "recovery" || type === "email")) {
        console.log("[v0] reset-password verifyOtp with token_hash")
        const { error } = await supabase.auth.verifyOtp({
          type: type as "recovery" | "email",
          token_hash: tokenHash,
        })
        url.searchParams.delete("token_hash")
        url.searchParams.delete("type")
        url.searchParams.delete("next")
        const clean = url.searchParams.toString()
        history.replaceState(null, "", url.pathname + (clean ? `?${clean}` : ""))
        if (finished) return
        if (error) {
          console.log("[v0] reset-password verifyOtp error:", error.message)
          settle("expired", `verifyOtp:${error.message}`)
        }
        return // success path settled by listener
      }

      // PKCE code flow.
      const code = url.searchParams.get("code")
      if (code) {
        console.log("[v0] reset-password exchangeCodeForSession")
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        url.searchParams.delete("code")
        const clean = url.searchParams.toString()
        history.replaceState(null, "", url.pathname + (clean ? `?${clean}` : ""))
        if (finished) return
        if (error) {
          console.log("[v0] reset-password exchangeCode error:", error.message)
          settle("expired", `exchangeCode:${error.message}`)
        }
        return // success path settled by listener
      }

      // Last resort: maybe auto-detect already established the session
      // (e.g. user refreshed the tab after it was already set up).
      const { data } = await supabase.auth.getUser()
      if (finished) return
      console.log("[v0] reset-password final getUser:", !!data.user)
      settle(data.user ? "ready" : "expired", data.user ? "getUser:hasUser" : "getUser:noUser")
    }

    run().catch((err) => {
      console.log("[v0] reset-password run() threw:", err)
      settle("expired", `threw:${String(err)}`)
    })

    return () => {
      finished = true
      subscription.unsubscribe()
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
      const supabase = supabaseRef.current!

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
          <p className="text-sm text-muted-foreground">Verifying your reset link&hellip;</p>
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
              quietly invalidate them before you click. Request a new one and open it right away &mdash; in the same
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
          <p className="font-medium">Password updated. Redirecting&hellip;</p>
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
