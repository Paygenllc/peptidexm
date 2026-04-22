"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

const PROD_ORIGIN = "https://www.peptidexm.com"

function getOrigin(headerList: Headers) {
  // 1. Explicit override (set this in Vercel env → production)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, "")

  // 2. In production, always use the canonical domain. Never trust the
  //    request host header for auth email links — it may be a preview URL,
  //    a localhost proxy, or an internal hostname, and Supabase will reject
  //    any redirect_to that isn't in its allow-list and fall back to its
  //    Site URL (often producing the "localhost + otp_expired" symptom).
  if (process.env.NODE_ENV === "production") return PROD_ORIGIN

  // 3. Dev fallback — use the current request.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  if (host) return `${proto}://${host}`
  return PROD_ORIGIN
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: error?.message || "Invalid email or password" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .single()

  // Admins go to the admin dashboard, everyone else to their account page.
  redirect(profile?.is_admin ? "/admin" : "/account")
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")
  const fullName = String(formData.get("full_name") || "").trim()

  if (!email || !password) return { error: "Email and password are required" }
  if (password.length < 8) return { error: "Password must be at least 8 characters" }

  const supabase = await createClient()
  const origin = getOrigin(await headers())

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: origin ? `${origin}/auth/confirm?next=/account` : undefined,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  if (!email) return { error: "Enter the email for your account" }

  const supabase = await createClient()
  const origin = getOrigin(await headers())
  // Land the user DIRECTLY on the reset-password page. Verification happens
  // client-side inside that page, so (a) the recovery session is established
  // in the same URL where the form lives (no lost-cookie-across-redirect bug),
  // and (b) email link scanners that pre-fetch URLs server-side (Outlook
  // SafeLinks, Gmail scanners, corporate security gateways) can't consume the
  // one-time token because the token handoff happens in JavaScript.
  const redirectTo = origin ? `${origin}/admin/reset-password` : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  // Don't leak whether the email exists — always report success.
  if (error) {
    console.error("[v0] requestPasswordReset error", error.message)
  }
  return { success: true }
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") || "")
  const confirmPassword = String(formData.get("confirm_password") || "")

  if (password.length < 8) return { error: "Password must be at least 8 characters" }
  if (password !== confirmPassword) return { error: "Passwords do not match" }

  const supabase = await createClient()

  // Must be called within a valid recovery session, which the /auth/confirm
  // route establishes before redirecting here.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your reset link has expired. Request a new one." }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  redirect(profile?.is_admin ? "/admin" : "/account")
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Customer-friendly sign-in URL. Works for both admins (they can
  // sign back in here and get routed to /admin by signInAction) and
  // shoppers. Avoids showing "admin" in the URL after a customer
  // signs out of their account.
  redirect("/signin")
}

/**
 * Bootstrap first admin. Only works when there are zero admins in the system.
 * The target user must have already signed up.
 */
export async function bootstrapAdminAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  const secret = String(formData.get("secret") || "")

  if (!email || !secret) return { error: "Email and bootstrap secret are required" }

  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET
  if (!expectedSecret) {
    return { error: "ADMIN_BOOTSTRAP_SECRET is not configured on the server." }
  }
  if (secret !== expectedSecret) {
    return { error: "Invalid bootstrap secret" }
  }

  const admin = createAdminClient()

  const { count } = await admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_admin", true)

  if ((count ?? 0) > 0) {
    return { error: "An admin already exists. Use an existing admin account to promote new admins." }
  }

  const { data: profile, error: findError } = await admin.from("profiles").select("id").eq("email", email).single()

  if (findError || !profile) {
    return { error: "No user found with that email. Have them sign up at /admin/signup first." }
  }

  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", profile.id)

  if (error) return { error: error.message }

  return { success: true }
}
