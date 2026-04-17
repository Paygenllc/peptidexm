import { createClient } from '@supabase/supabase-js'

/**
 * Admin client using the service role key.
 * Bypasses RLS. NEVER expose to the browser.
 * Use only in server actions, route handlers, and server components
 * where you need to perform privileged operations (e.g. guest checkout
 * inserts or admin operations before the user session is established).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
