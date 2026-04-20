import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Redirects to /admin/login if the current user is not signed in
 * or is not an admin. Returns the user and profile row when allowed.
 * 
 * Uses `.maybeSingle()` so a missing profile returns null instead of
 * throwing — which allows us to clearly distinguish "no profile" from
 * transient DB errors.
 */
export async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  // DB query errors or missing profile = redirect to login
  // Don't throw — redirect() handles the control flow
  if (error) {
    console.log("[v0] requireAdmin profiles query error:", error)
    redirect('/admin/login?error=server_error')
  }

  if (!profile || !profile.is_admin) {
    redirect('/admin/login?error=not_admin')
  }

  return { user, profile }
}
