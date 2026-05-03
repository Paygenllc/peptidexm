"use server"

import { createClient } from "@/lib/supabase/server"
import { sendWelcomeCouponEmail } from "@/lib/email"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Sources that should trigger an auto-issued welcome coupon. We keep
 * this allow-listed (rather than always-on) because the footer
 * subscription is a low-friction "stay in the loop" CTA — handing
 * out a code there would devalue the offer. The home-page floating
 * popover and any future "10% off" placements explicitly opt in.
 */
const WELCOME_COUPON_SOURCES = new Set(["home_floating_promo", "discount_popover"])

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
 *
 * When the source is one of the discount-popover surfaces, we also call
 * `issue_welcome_coupon` to mint a unique one-use 10%-off code for that
 * email and email it to them. The function is idempotent on
 * (customer_email, source='newsletter_welcome') so re-subscribing
 * returns the same code rather than minting a new one — which keeps
 * abuse low and lets the popover show the existing code if the
 * visitor hits subscribe twice.
 */
export async function subscribeToNewsletterAction(
  prevState: { success?: boolean; error?: string; couponCode?: string } | null,
  formData: FormData,
): Promise<{ success?: boolean; error?: string; couponCode?: string }> {
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

  // For discount-popover sources, mint (or fetch existing) the
  // welcome coupon and email it. Coupon failures are non-fatal —
  // the subscription is already saved, so we still return success
  // with no `couponCode` and the UI gracefully falls back to a plain
  // "thanks for subscribing" message.
  let couponCode: string | undefined
  if (WELCOME_COUPON_SOURCES.has(source)) {
    const { data: code, error: couponErr } = await supabase.rpc(
      "issue_welcome_coupon",
      { p_email: raw },
    )
    if (couponErr) {
      console.error("[v0] welcome coupon issue error:", couponErr.message)
    } else if (typeof code === "string" && code) {
      couponCode = code
      // Fire-and-forget — subscribe response is what the visitor is
      // waiting for. The email is a bonus channel; if Resend hiccups
      // we still showed the code on-screen.
      void sendWelcomeCouponEmail({
        to: raw,
        code,
        // Coupons created by issue_welcome_coupon get a 60-day expiry.
        expiresAtIso: null,
      })
    }
  }

  return { success: true, couponCode }
}
