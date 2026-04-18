"use server"

import { createClient } from "@/lib/supabase/server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Public-facing newsletter signup.
 *
 * The previous implementation upserted directly from an anon Supabase client,
 * which only has an INSERT policy on newsletter_subscribers — so the UPDATE
 * path of an `ON CONFLICT DO UPDATE` was silently blocked by RLS and the
 * action surfaced a generic error. We now delegate the whole flow to a
 * SECURITY DEFINER Postgres function (`public.subscribe_to_newsletter`) that
 * handles validation, upsert, re-activation of unsubscribed rows, and syncing
 * `profiles.newsletter_subscribed` atomically.
 */
export async function subscribeToNewsletterAction(
  prevState: { success?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase()
  const source = String(formData.get("source") ?? "footer").trim() || "footer"

  if (!raw) return { error: "Please enter your email address." }
  if (!EMAIL_RE.test(raw)) return { error: "That doesn't look like a valid email address." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("subscribe_to_newsletter", {
    p_email: raw,
    p_source: source,
  })

  if (error) {
    // The function raises `email_invalid` / `email_required` for bad input;
    // everything else is an unexpected server issue worth logging.
    if (error.message?.includes("email_invalid") || error.message?.includes("email_required")) {
      return { error: "That doesn't look like a valid email address." }
    }
    console.error("[v0] newsletter subscribe error:", error.message)
    return { error: "We couldn't save your subscription. Please try again." }
  }

  return { success: true }
}
