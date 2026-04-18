"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"

/**
 * Toggle whether a user is flagged as an admin.
 * Admins cannot demote themselves — prevents a lockout where the last admin
 * accidentally strips their own privileges and can no longer access the dashboard.
 */
export async function toggleAdminAction(formData: FormData) {
  const { user } = await requireAdmin()
  const userId = String(formData.get("userId") || "")
  const makeAdmin = String(formData.get("makeAdmin") || "") === "true"

  if (!userId) return { error: "Missing user id" }
  if (userId === user.id && !makeAdmin) {
    return { error: "You cannot remove admin from your own account" }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: makeAdmin })
    .eq("id", userId)

  if (error) return { error: error.message }

  revalidatePath("/admin/customers")
  revalidatePath(`/admin/customers/${userId}`)
  return { success: true }
}

/**
 * Ban or unban a user. Banning sets banned_at = now() in profiles AND
 * uses the Supabase admin API to block their auth session so they can't
 * log back in until unbanned.
 */
export async function toggleBanAction(formData: FormData) {
  const { user } = await requireAdmin()
  const userId = String(formData.get("userId") || "")
  const ban = String(formData.get("ban") || "") === "true"

  if (!userId) return { error: "Missing user id" }
  if (userId === user.id) return { error: "You cannot ban your own account" }

  const supabase = await createClient()
  const admin = createAdminClient()

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ banned_at: ban ? new Date().toISOString() : null })
    .eq("id", userId)

  if (profileErr) return { error: profileErr.message }

  // `ban_duration: 'none'` restores access. '876000h' ≈ 100 years (max allowed).
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: ban ? "876000h" : "none",
  })
  if (authErr) {
    // Best-effort: the profile flag already changed, but log the auth failure.
    console.error("[v0] toggleBanAction auth error", authErr)
  }

  revalidatePath("/admin/customers")
  revalidatePath(`/admin/customers/${userId}`)
  return { success: true }
}

/**
 * Toggle whether a user receives marketing broadcasts. Operates purely on the
 * profile row; the broadcast sender respects this flag before dispatching.
 */
export async function toggleNewsletterAction(formData: FormData) {
  await requireAdmin()
  const userId = String(formData.get("userId") || "")
  const subscribe = String(formData.get("subscribe") || "") === "true"

  if (!userId) return { error: "Missing user id" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ newsletter_subscribed: subscribe })
    .eq("id", userId)

  if (error) return { error: error.message }

  revalidatePath("/admin/customers")
  revalidatePath(`/admin/customers/${userId}`)
  return { success: true }
}

/**
 * Permanently delete a user account (and, via cascading FKs, their profile,
 * orders history link, etc.). Orders themselves are kept for bookkeeping by
 * setting user_id to null via the FK ON DELETE SET NULL rule.
 */
export async function deleteUserAction(formData: FormData) {
  const { user } = await requireAdmin()
  const userId = String(formData.get("userId") || "")

  if (!userId) return { error: "Missing user id" }
  if (userId === user.id) return { error: "You cannot delete your own account" }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath("/admin/customers")
  return { success: true }
}
