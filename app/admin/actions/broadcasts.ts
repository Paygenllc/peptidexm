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

const ALLOWED_AUDIENCES: ReadonlySet<BroadcastAudience> = new Set([
  "subscribers",
  "all_customers",
  "admins",
  "custom",
])

/**
 * Actually send the broadcast. Accepts the live form values (subject/preview/
 * body/audience/custom_recipients) so the UI can save and send atomically —
 * eliminating the earlier bug where changing the audience dropdown without
 * clicking Save first meant the send used the old, persisted audience.
 *
 * Unknown audience strings fail closed with a clear error rather than
 * silently defaulting to "everyone".
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

  // Prefer fresh values from the form (so a change in the editor doesn't need
  // an explicit "Save" click first); fall back to what's in the DB.
  const rawSubject = String(formData.get("subject") ?? "").trim()
  const rawPreview = String(formData.get("preview") ?? "").trim()
  const rawBody = String(formData.get("body_markdown") ?? "").trim()
  const rawAudience = String(
    formData.get("audience") ?? broadcast.audience ?? "",
  ).trim() as BroadcastAudience
  const rawCustom = String(formData.get("custom_recipients") ?? "")

  const subject = rawSubject || broadcast.subject
  const preview = rawPreview || broadcast.preview
  const bodyMarkdown = rawBody || broadcast.body_markdown
  const audience: BroadcastAudience = ALLOWED_AUDIENCES.has(rawAudience)
    ? rawAudience
    : (broadcast.audience as BroadcastAudience)

  if (!ALLOWED_AUDIENCES.has(audience)) {
    return { error: `Unrecognized audience "${audience}". Refusing to send.` }
  }
  if (!subject) return { error: "Subject is required" }
  if (!bodyMarkdown) return { error: "Body is required" }

  // Parse custom list from the form if provided, otherwise use whatever is
  // already saved on the row.
  const customList: string[] = formData.has("custom_recipients")
    ? parseCustomRecipients(rawCustom).valid
    : Array.isArray(broadcast.custom_recipients)
      ? (broadcast.custom_recipients as string[])
      : []

  if (audience === "custom" && customList.length === 0) {
    return { error: "Add at least one valid email address for the custom list." }
  }

  // Persist the live form values so the DB always reflects what was actually sent.
  const { error: persistErr } = await supabase
    .from("email_broadcasts")
    .update({
      subject,
      preview: preview || null,
      body_markdown: bodyMarkdown,
      audience,
      custom_recipients: customList,
    })
    .eq("id", id)
  if (persistErr) return { error: persistErr.message }

  // Build the base audience list from the DB unless this is a pure "custom" send.
  let base: Array<{ email: string; full_name: string | null }> = []
  if (audience !== "custom") {
    let q = supabase.from("profiles").select("email, full_name")
    if (audience === "subscribers") {
      q = q.eq("newsletter_subscribed", true).is("banned_at", null)
    } else if (audience === "all_customers") {
      q = q.is("banned_at", null)
    } else if (audience === "admins") {
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
    if (audience === "subscribers") {
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

  // Use the live (just-persisted) values, not the original snapshot.
  const bodyHtml = markdownToHtml(bodyMarkdown)
  const textFallback = markdownToPlainText(bodyMarkdown)

  let sent = 0
  let failed = 0

  for (const r of valid) {
    try {
      const res = await sendBroadcastEmail({
        to: r.email,
        subject,
        preview,
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
