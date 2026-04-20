import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminShell } from "./admin-shell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    console.log("[v0] admin layout: starting")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    console.log("[v0] admin layout: got user", user?.id ? "✓" : "✗")

    if (!user) {
      console.log("[v0] admin layout: no user, redirecting to login")
      redirect("/admin/login")
    }

    // Use `.maybeSingle()` instead of `.single()` so a missing profile row
    // returns null instead of throwing PGRST116. That error surfaces as a
    // cryptic "Server Components render" digest error in production.
    console.log("[v0] admin layout: fetching profile for", user.id)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_admin, email, full_name")
      .eq("id", user.id)
      .maybeSingle()

    console.log("[v0] admin layout: profile query result", {
      hasProfile: !!profile,
      hasError: !!error,
      errorMsg: error?.message,
    })

    if (error) {
      console.log("[v0] admin layout profiles error:", error)
      redirect("/admin/login?error=server_error")
    }

    if (!profile?.is_admin) {
      console.log("[v0] admin layout: user is not admin, redirecting")
      redirect("/admin/login?error=not_admin")
    }

    console.log("[v0] admin layout: rendering shell with email", profile.email)
    return <AdminShell email={profile.email}>{children}</AdminShell>
  } catch (err) {
    console.log("[v0] admin layout caught error:", err instanceof Error ? err.message : String(err))
    throw err
  }
}
