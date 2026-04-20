"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { sendBroadcastEmail } from "@/lib/email"
import { markdownToHtml, markdownToPlainText } from "@/lib/markdown"
import { renderContentWithProducts } from "@/lib/product-embeds"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { generateText, Output } from "ai"
import { z } from "zod"
import {
  AUTOBLOG_TONES,
  TONE_KEYS,
  type AutoblogTone,
} from "@/lib/autoblog-config"
import { products, productSlug } from "@/lib/products-catalog"

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
 *
 * Returns the new id so the client can router.push() instead of us calling
 * `redirect()` here. A server-action `redirect()` fights with the
 * `startTransition`+`await` pattern the editor uses and occasionally leaves
 * the UI stuck in a spinner on Next 16 — returning plain data is reliable.
 */
export async function createBroadcastDraftAction(formData: FormData) {
  let user
  try {
    ;({ user } = await requireAdmin())
  } catch (err) {
    console.log("[v0] createBroadcastDraftAction: requireAdmin failed", err)
    return { error: "You must be signed in as an admin." }
  }

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

  if (error) {
    console.log("[v0] createBroadcastDraftAction: insert failed", error)
    return { error: error.message }
  }

  revalidatePath("/admin/email")
  return { success: true as const, id: data.id }
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
 * Duplicate an existing broadcast (typically a sent one) as a fresh draft.
 *
 * Handy for running the same campaign to a different audience, or iterating
 * on subject/copy from a known-good starting point. Status fields (sent_at,
 * recipient/sent/failed counts) are all reset so analytics stay honest.
 */
export async function duplicateBroadcastAction(formData: FormData) {
  const { user } = await requireAdmin()
  const id = String(formData.get("id") || "")
  if (!id) return { error: "Missing broadcast id" }

  const supabase = await createClient()
  const { data: source, error: loadErr } = await supabase
    .from("email_broadcasts")
    .select("subject, preview, body_markdown, audience, custom_recipients")
    .eq("id", id)
    .single()
  if (loadErr || !source) return { error: "Broadcast not found" }

  const { data: inserted, error: insertErr } = await supabase
    .from("email_broadcasts")
    .insert({
      subject: prefixCopy(source.subject),
      preview: source.preview,
      body_markdown: source.body_markdown,
      audience: source.audience,
      custom_recipients: source.custom_recipients ?? [],
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (insertErr || !inserted) return { error: insertErr?.message ?? "Couldn't duplicate" }

  revalidatePath("/admin/email")
  redirect(`/admin/email/${inserted.id}`)
}

/**
 * Prefix the duplicated subject so the copy is obvious at a glance, but only
 * once — re-duplicating doesn't keep stacking "(copy) (copy) (copy)".
 */
function prefixCopy(subject: string): string {
  const trimmed = subject.trim()
  if (/^\(copy\)/i.test(trimmed)) return trimmed
  return `(copy) ${trimmed}`.slice(0, 120)
}

/**
 * AI-generated broadcast draft.
 *
 * Produces subject / preview / body markdown in one shot so the admin can
 * review-and-send rather than starting from a blank textarea. We reuse the
 * autoblog tone directives so voice stays consistent across the site's
 * editorial surfaces — newsletter voice should match blog voice.
 *
 * Body is markdown (not HTML) because the broadcast editor renders markdown
 * natively and supports our [[product:slug]] embed tokens.
 */
const BroadcastDraftSchema = z.object({
  subject: z.string().describe("Email subject line, max 80 characters. Specific and compelling, not clickbait."),
  preview: z
    .string()
    .describe(
      "Inbox preview text (max 140 chars). Complements — does not repeat — the subject.",
    ),
  body_markdown: z
    .string()
    .describe(
      "Email body in markdown. Use # headings, **bold**, _italic_, [links](url), - bullet lists, > blockquotes. " +
        "To embed a product card, put [[product:<slug>]] on its own line using one of the slugs from the catalog. " +
        "Never embed more than 2 product tokens. End with a short closing line.",
    ),
})

export type BroadcastDraft = z.infer<typeof BroadcastDraftSchema>

type BroadcastDraftResult = { draft: BroadcastDraft } | { error: string }

function buildProductCatalogSummary(): string {
  return products
    .map((p) => `- ${p.name} (slug: ${productSlug(p)}, category: ${p.category})`)
    .join("\n")
}

/**
 * Goal buckets map to campaign-specific instructions layered on top of the
 * shared tone. E.g. a "product launch" in a conversational tone still needs
 * a CTA and a dated launch hook — the goal captures that.
 */
const BROADCAST_GOAL_DIRECTIVES: Record<string, string> = {
  announcement:
    "This is a customer announcement. Open with the news, explain why it matters in 1–2 paragraphs, close with a clear next step (browse, read the blog post, reply).",
  launch:
    "This is a product launch. Open with the product hook, use exactly one [[product:slug]] embed for the launching product, add 2–3 benefit bullets, close with a launch-day CTA.",
  promotion:
    "This is a promotional campaign. Lead with the offer and its end date, explain what's included in plain terms, and close with an urgent CTA. Never imply therapeutic benefit.",
  newsletter:
    "This is a periodic newsletter. Pick 2–3 topical items (new products, research notes, stock updates) and present each under a short bold lead-in. Keep the overall email scannable.",
  educational:
    "This is an educational email. Teach one idea well. No hard sell — optionally include one [[product:slug]] embed if it naturally illustrates the concept.",
  reengagement:
    "This is a re-engagement email to lapsed customers. Warm open, brief recap of what's new since they last visited, low-pressure CTA.",
}

export const BROADCAST_GOALS = Object.keys(BROADCAST_GOAL_DIRECTIVES) as [
  string,
  ...string[],
]

export async function generateBroadcastDraftAction(
  formData: FormData,
): Promise<BroadcastDraftResult> {
  try {
    await requireAdmin()
  } catch (err) {
    console.log("[v0] broadcast drafter: requireAdmin failed", err)
    return { error: "You must be signed in as an admin to generate drafts." }
  }

  const topic = String(formData.get("topic") ?? "").trim()
  const goalRaw = String(formData.get("goal") ?? "newsletter").trim()
  const toneRaw = String(formData.get("tone") ?? "conversational").trim()
  const keywords = String(formData.get("keywords") ?? "").trim()
  const audience = String(formData.get("audience") ?? "").trim()

  if (!topic) return { error: "Describe what this email is about." }
  if (topic.length > 500) return { error: "Brief is too long. Keep it under 500 characters." }

  const toneKey: AutoblogTone = (TONE_KEYS as readonly string[]).includes(toneRaw)
    ? (toneRaw as AutoblogTone)
    : "conversational"
  const goalDirective =
    BROADCAST_GOAL_DIRECTIVES[goalRaw] ?? BROADCAST_GOAL_DIRECTIVES.newsletter

  const system = [
    "You are the senior email copywriter for PeptideXM, a research-peptide supplier.",
    "You write short, engaging transactional/marketing emails for a US research-only audience.",
    "Emails must never recommend human self-administration, never claim to diagnose or",
    "treat disease, and never make unqualified medical promises.",
    "",
    "## Shop catalog (use these EXACT slugs inside [[product:<slug>]] tokens)",
    buildProductCatalogSummary(),
    "",
    "## Voice directive",
    AUTOBLOG_TONES[toneKey].directive,
    "",
    "## Campaign goal",
    goalDirective,
    "",
    "## Output rules",
    "- Body is MARKDOWN (not HTML). Allowed: # heading, ## subheading, **bold**, _italic_, [link](url), - list, > quote, [[product:slug]] tokens.",
    "- Keep the email short enough to read in 30 seconds unless the goal genuinely demands more.",
    "- Use at most ONE H1 (#) heading at the very top, optional.",
    "- Always include a clear, single primary CTA — either a markdown link or a product embed.",
    "- Subjects: specific, no ALL-CAPS, no clickbait (\"You won't believe…\"). Max 80 chars.",
    "- Preview text complements the subject — don't just restate it.",
  ].join("\n")

  const userPrompt = [
    `Brief: ${topic}`,
    keywords ? `Keywords to weave in naturally: ${keywords}` : "",
    audience ? `Primary reader: ${audience}` : "Primary reader: an existing PeptideXM customer on our newsletter list.",
    "",
    "Generate the subject, preview, and markdown body now.",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      system,
      prompt: userPrompt,
      experimental_output: Output.object({ schema: BroadcastDraftSchema }),
    })

    const draft = result.experimental_output
    if (!draft) return { error: "The AI returned an empty draft. Try again." }

    return {
      draft: {
        subject: draft.subject.trim().slice(0, 120),
        preview: draft.preview.trim().slice(0, 200),
        body_markdown: draft.body_markdown.trim(),
      },
    }
  } catch (err) {
    console.log("[v0] broadcast drafter: generation failed", err)
    const msg = err instanceof Error ? err.message : String(err)
    if (/api.*key|unauthor|forbidden/i.test(msg)) {
      return {
        error:
          "AI provider not configured. Check your Vercel AI Gateway settings.",
      }
    }
    return { error: "The AI couldn't generate a draft. Please try again in a moment." }
  }
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
  // Expand `[[product:slug]]` tokens into inline-styled product cards now,
  // once, so every recipient gets the same rendered HTML without repeating
  // the DB lookup per recipient.
  const rawBodyHtml = markdownToHtml(bodyMarkdown)
  const bodyHtml = await renderContentWithProducts(rawBodyHtml, "email")
  const textFallback = markdownToPlainText(
    // Strip tokens from the plain-text fallback so recipients with HTML
    // disabled don't see "[[product:bpc-157]]" in the body.
    bodyMarkdown.replace(/\[\[product:[a-z0-9][a-z0-9-]*\]\]/gi, ""),
  )

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
