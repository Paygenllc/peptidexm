import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { type EmailOtpType } from "@supabase/supabase-js"
import { AuthConfirmClient } from "./auth-confirm-client"

/**
 * Handles every email-link format Supabase can send, so password resets,
 * signup confirmations, and magic links all land successfully:
 *
 *   1. `?token_hash=XXX&type=recovery` — the new server-side flow (recommended
 *      email-template format). Verified here with `verifyOtp`.
 *
 *   2. `?code=XXX` — the PKCE code-exchange flow (OAuth + newer magic links).
 *      Exchanged here for a session.
 *
 *   3. `#access_token=...&refresh_token=...&type=recovery` — the implicit
 *      flow used by Supabase's DEFAULT `{{ .ConfirmationURL }}` email
 *      templates. The hash never reaches the server, so we render a tiny
 *      client component that calls `setSession` with the hash tokens.
 *
 *   4. `?error=...` or `#error=...` — forwarded to the friendly error page.
 */
export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string
    type?: string
    code?: string
    next?: string
    error?: string
    error_code?: string
    error_description?: string
  }>
}) {
  const params = await searchParams
  const next = params.next || "/account"

  // Explicit error surfaced in the query string (rare — usually it's in hash).
  if (params.error) {
    const message = (params.error_description || params.error).replace(/\+/g, " ")
    redirect(`/auth/error?message=${encodeURIComponent(message)}`)
  }

  const supabase = await createClient()

  // Server-verifiable: new token_hash email-template format.
  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      type: params.type as EmailOtpType,
      token_hash: params.token_hash,
    })
    if (!error) redirect(next)
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  // Server-verifiable: PKCE code exchange.
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code)
    if (!error) redirect(next)
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  // Fall through to the client — it will inspect the hash fragment.
  return <AuthConfirmClient next={next} />
}
