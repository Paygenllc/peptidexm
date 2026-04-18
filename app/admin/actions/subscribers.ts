"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"

/**
 * Remove a standalone newsletter subscriber (someone who used the footer form
 * without ever creating an account). Hard delete — there's nothing else in
 * the system referencing this row.
 */
export async function removeStandaloneSubscriberAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  if (!id) return { error: "Missing id" }

  const supabase = await createClient()
  const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/admin/email/subscribers")
  revalidatePath("/admin/email")
  return { success: true }
}
