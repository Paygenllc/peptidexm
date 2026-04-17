'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: error?.message || 'Invalid credentials' }
  }

  // Check admin flag
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .single()

  if (!profile?.is_admin) {
    await supabase.auth.signOut()
    return { error: 'This account does not have admin access.' }
  }

  redirect('/admin')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

/**
 * Promote an email to admin. This uses the service role key and
 * is used for the initial admin bootstrap. It only works if there
 * are currently 0 admins in the system OR the caller is already an admin.
 */
export async function promoteToAdmin(email: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Count existing admins
  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', true)

  const existingAdmins = count ?? 0

  if (existingAdmins > 0) {
    // Only existing admins can promote others
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { data: me } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!me?.is_admin) {
      return { error: 'Not authorized' }
    }
  }

  // Find the profile by email
  const { data: profile, error: findError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (findError || !profile) {
    return { error: 'No user found with that email. Have them sign up first.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', profile.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
