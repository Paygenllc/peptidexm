import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Redirects to /admin/login if the current user is not signed in
 * or is not an admin. Returns the user and profile row when allowed.
 * 
 * Uses `.maybeSingle()` so a missing profile returns null instead of
 * throwing — which allows us to clearly distinguish "no profile" from
 * transient DB errors. Also wraps the profiles SELECT in try/catch to
 * avoid letting transient Supabase failures spiral into crashes.
 */
export async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  let profile
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.log("[v0] requireAdmin profiles query error:", error)
      throw new Error('Could not verify admin status')
    }
    profile = data
  } catch (err) {
    console.log("[v0] requireAdmin threw:", err)
    throw err
  }

  if (!profile || !profile.is_admin) {
    redirect('/admin/login?error=not_admin')
  }

  return { user, profile }
}
