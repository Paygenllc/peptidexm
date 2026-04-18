"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { sendBroadcastEmail } from "@/lib/email"
import { markdownToHtml, markdownToPlainText } from "@/lib/markdown"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export type BroadcastAudience = "subscribers" | "all_customers" | "admins" | "custom"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Parse a free-form textarea of emails (comma, semicolon, or whitespace-separated)
 * into a normalized, deduped, validated list. Also returns how many attempted
 * tokens were invalid, so the UI can show "N addresses were skipped".
 */
function parseCustomRecipients(raw: string): { valid: string[]; invalid: number } {
  const candidates = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const valid: string[] = []
  let invalid = 0
  for (const c of candidates) {
    const lower = c.toLowerCase()
    if (!EMAIL_RE.test(lower)) {
      invalid += 1
      continue
    }
    if (seen.has(lower)) continue
    seen.add(lower)
    valid.push(lower)
  }
  return { valid, invalid }
}

/**
 * Create a draft broadcast. Keeping drafts around so admins can compose,
 * preview, and send later — the sending step is a separate action.
 */
export async function createBroadcastDraftAction(formData: FormData) {
  const { user } = await requireAdmin()

  const subject = String(formData.get("subject") || "").trim()
  const preview = String(formData.get("preview") || "").trim()
  const bodyMarkdown = String(formData.get("body_markdown") || "").trim()
  const audience = (String(formData.get("audience") || "subscribers") as BroadcastAudience)
  const { valid: customRecipients } = parseCustomRecipients(
    String(formData.get("custom_recipients") || ""),
  )

  if (!subject) return { error: "Subject is required" }
  if (!bodyMarkdown) return { error: "Body is required" }
  if (audience === "custom" && customRecipients.length === 0) {
    return { error: "Add at least one valid email address for the custom list." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("email_broadcasts")
    .insert({
      subject,
      preview: preview || null,
      body_markdown: bodyMarkdown,
      audience,
      custom_recipients: customRecipients,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/admin/email")
  redirect(`/admin/email/${data.id}`)
}

export async function updateBroadcastAction(formData: FormData) {
  await requireAdmin()

  const id = String(formData.get("id") || "")
  const subject = String(formData.get("subject") || "").trim()
  const preview = String(formData.get("preview") || "").trim()
  const bodyMarkdown = String(formData.get("body_markdown") || "").trim()
  const audience = String(formData.get("audience") || "subscribers")
  const { valid: customRecipients } = parseCustomRecipients(
    String(formData.get("custom_recipients") || ""),
  )

  if (!id) return { error: "Missing broadcast id" }
  if (!subject) return { error: "Subject is required" }
  if (!bodyMarkdown) return { error: "Body is required" }
  if (audience === "custom" && customRecipients.length === 0) {
    return { error: "Add at least one valid email address for the custom list." }
  }

  const supabase = await createClient()
  // Never mutate a broadcast that has already been sent — keeps the audit trail honest.
  const { data: existing } = await supabase
    .from("email_broadcasts")
    .select("status")
    .eq("id", id)
    .single()
  if (existing?.status === "sent") return { error: "Sent broadcasts cannot be edited" }

  const { error } = await supabase
    .from("email_broadcasts")
    .update({
      subject,
      preview: preview || null,
      body_markdown: bodyMarkdown,
      audience,
      custom_recipients: customRecipients,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin/email")
  revalidatePath(`/admin/email/${id}`)
  return { success: true }
}

export async function deleteBroadcastAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  if (!id) return { error: "Missing broadcast id" }

  const supabase = await createClient()
  const { error } = await supabase.from("email_broadcasts").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/admin/email")
  redirect("/admin/email")
}

/**
 * Actually send the broadcast. Pulls the recipient list based on the stored
 * audience + marketing subscription flag, then loops through it sending one
 * email at a time. We sleep briefly between sends to be friendly to Resend's
 * rate limit (2 req/sec on the free plan).
 */
export async function sendBroadcastAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  if (!id) return { error: "Missing broadcast id" }

  const supabase = await createClient()
  const { data: broadcast, error: loadErr } = await supabase
    .from("email_broadcasts")
    .select("*")
    .eq("id", id)
    .single()

  if (loadErr || !broadcast) return { error: "Broadcast not found" }
  if (broadcast.status === "sent") return { error: "Already sent" }

  const customList: string[] = Array.isArray(broadcast.custom_recipients)
    ? (broadcast.custom_recipients as string[])
    : []

  // Build the base audience list from the DB unless this is a pure "custom" send.
  let base: Array<{ email: string; full_name: string | null }> = []
  if (broadcast.audience !== "custom") {
    let q = supabase.from("profiles").select("email, full_name")
    if (broadcast.audience === "subscribers") {
      q = q.eq("newsletter_subscribed", true).is("banned_at", null)
    } else if (broadcast.audience === "all_customers") {
      q = q.is("banned_at", null)
    } else if (broadcast.audience === "admins") {
      q = q.eq("is_admin", true)
    }
    const { data: recipients, error: recErr } = await q
    if (recErr) return { error: recErr.message }
    base = (recipients ?? []).filter(
      (r): r is { email: string; full_name: string | null } => !!r.email,
    )

    // For the "subscribers" audience we also want standalone newsletter
    // subscribers (people who used the footer form but never created an
    // account). They don't have a full_name.
    if (broadcast.audience === "subscribers") {
      const { data: standalone, error: sErr } = await supabase
        .from("newsletter_subscribers")
        .select("email")
        .is("unsubscribed_at", null)
      if (sErr) return { error: sErr.message }
      for (const row of standalone ?? []) {
        if (row.email) base.push({ email: row.email, full_name: null })
      }
    }
  }

  // Merge custom recipients on top, de-duping by lowercased email. This lets
  // admins send to e.g. "Subscribers + these 3 extras" without double-emailing.
  const seen = new Set(base.map((r) => r.email.toLowerCase()))
  for (const email of customList) {
    const lower = email.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    base.push({ email, full_name: null })
  }
  const valid = base

  // Mark as "sending" so UI reflects state during long loops.
  await supabase
    .from("email_broadcasts")
    .update({ status: "sending", recipient_count: valid.length })
    .eq("id", id)

  const bodyHtml = markdownToHtml(broadcast.body_markdown)
  const textFallback = markdownToPlainText(broadcast.body_markdown)

  let sent = 0
  let failed = 0

  for (const r of valid) {
    try {
      const res = await sendBroadcastEmail({
        to: r.email,
        subject: broadcast.subject,
        preview: broadcast.preview,
        bodyHtml,
        textFallback,
      })
      if ("error" in res && res.error) failed += 1
      else sent += 1
    } catch (err) {
      console.error("[v0] broadcast send failed for", r.email, err)
      failed += 1
    }
    // Throttle: ~2 emails / second keeps us well under typical provider limits.
    await new Promise((resolve) => setTimeout(resolve, 450))
  }

  await supabase
    .from("email_broadcasts")
    .update({
      status: "sent",
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)

  revalidatePath("/admin/email")
  revalidatePath(`/admin/email/${id}`)
  return { success: true, sent, failed }
}
