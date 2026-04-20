import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminShell } from "./admin-shell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin/login")
  }

  // Use `.maybeSingle()` instead of `.single()` so a missing profile row
  // returns null instead of throwing PGRST116. That error surfaces as a
  // cryptic "Server Components render" digest error in production.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin, email, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.log("[v0] admin layout profiles error:", error)
    redirect("/admin/login?error=server_error")
  }

  if (!profile?.is_admin) {
    redirect("/admin/login?error=not_admin")
  }

  return <AdminShell email={profile.email}>{children}</AdminShell>
}
