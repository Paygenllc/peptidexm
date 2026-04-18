"use server"

import { createClient } from "@/lib/supabase/server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function subscribeToNewsletterAction(
  prevState: { success?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase()
  const source = String(formData.get("source") ?? "footer").trim() || "footer"

  if (!raw) return { error: "Please enter your email address." }
  if (!EMAIL_RE.test(raw)) return { error: "That doesn't look like a valid email address." }

  const supabase = await createClient()

  // Also mark an existing profile opted in, if this email already belongs to a
  // customer account. Keeps the two tables in sync for marketing queries.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, newsletter_subscribed")
    .eq("email", raw)
    .maybeSingle()

  if (existingProfile && !existingProfile.newsletter_subscribed) {
    await supabase
      .from("profiles")
      .update({ newsletter_subscribed: true })
      .eq("id", existingProfile.id)
  }

  // Upsert into the standalone subscribers table. On conflict, re-activate a
  // previously unsubscribed row so people who come back aren't silently ignored.
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      {
        email: raw,
        source,
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    )

  if (error) {
    console.error("[v0] newsletter subscribe error:", error.message)
    return { error: "We couldn't save your subscription. Please try again." }
  }

  return { success: true }
}
