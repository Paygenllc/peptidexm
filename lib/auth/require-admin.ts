import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Redirects to /admin/login if the current user is not signed in
 * or is not an admin. Returns the user and profile row when allowed.
 */
export async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_admin) {
    redirect('/admin/login?error=not_admin')
  }

  return { user, profile }
}
