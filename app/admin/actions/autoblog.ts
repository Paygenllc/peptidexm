"use server"

import { generateText, Output } from "ai"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/require-admin"
import { products, productSlug } from "@/lib/products-catalog"
import {
  AUTOBLOG_TONES,
  AUTOBLOG_LENGTHS,
  TONE_KEYS,
  LENGTH_KEYS,
  NATURAL_VOICE_GUARDRAIL,
  type AutoblogTone,
  type AutoblogLength,
} from "@/lib/autoblog-config"

/**
 * Autoblog: generate a blog post draft from a topic.
 *
 * Uses the Vercel AI Gateway (zero-config for openai/gpt-5-mini) and the
 * `Output.object()` pattern to get a strictly-typed structured response.
 *
 * Tones and lengths are defined in `lib/autoblog-config.ts` — shared with
 * the client UI so adding a new voice is a one-file change.
 */

const DraftSchema = z.object({
  title: z.string().describe("Concise, specific, SEO-friendly post title (max 90 chars)"),
  slug: z
    .string()
    .describe(
      "URL slug derived from the title: lowercase, hyphenated, ascii-only, no leading/trailing dashes (max 80 chars)",
    ),
  excerpt: z
    .string()
    .describe("One-sentence summary shown on the blog index and in link previews (max 220 chars)"),
  content_html: z
    .string()
    .describe(
      "Full blog post body as valid HTML. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <a>. " +
        "Do NOT include <html>, <body>, <head>, <script>, <style>, or inline style attributes. " +
        "To link a product we sell, insert the token [[product:<slug>]] on its own line where the product card should appear. " +
        "Structure: opening paragraph, H2 sections per the length directive, each with 1–3 paragraphs and optionally a bulleted list, closing summary paragraph.",
    ),
  tags: z
    .array(z.string())
    .describe("Up to 5 short topical tags (lowercase, kebab-case, no hashes, no duplicates)"),
})

type DraftResult =
  | { draft: z.infer<typeof DraftSchema> }
  | { error: string }

function buildProductCatalogSummary(): string {
  // Keep the system prompt payload small: name + slug + category is enough
  // for the model to pick relevant products without burning tokens on
  // pricing or variant data it can't use in the post body anyway.
  return products
    .map((p) => `- ${p.name} (slug: ${productSlug(p)}, category: ${p.category})`)
    .join("\n")
}

export async function generateBlogDraftAction(formData: FormData): Promise<DraftResult> {
  try {
    await requireAdmin()
  } catch (err) {
    console.log("[v0] autoblog: requireAdmin failed", err)
    return { error: "You must be signed in as an admin to generate drafts." }
  }

  const topicRaw = String(formData.get("topic") ?? "").trim()
  const keywordsRaw = String(formData.get("keywords") ?? "").trim()
  const audienceRaw = String(formData.get("audience") ?? "").trim()
  const toneRaw = String(formData.get("tone") ?? "research").trim()
  const lengthRaw = String(formData.get("length") ?? "medium").trim()

  if (!topicRaw) return { error: "Enter a topic for the AI to write about." }
  if (topicRaw.length > 500) return { error: "Topic is too long. Keep it under 500 characters." }
  if (keywordsRaw.length > 400) return { error: "Keyword list is too long. Keep it under 400 characters." }
  if (audienceRaw.length > 200) return { error: "Audience description is too long. Keep it under 200 characters." }

  // Fail-closed tone/length: if the UI ever sends an unknown value (stale
  // cache, manual request), fall back to sensible defaults rather than
  // silently skipping the directive.
  const toneKey: AutoblogTone = (TONE_KEYS as readonly string[]).includes(toneRaw)
    ? (toneRaw as AutoblogTone)
    : "research"
  const lengthKey: AutoblogLength = (LENGTH_KEYS as readonly string[]).includes(lengthRaw)
    ? (lengthRaw as AutoblogLength)
    : "medium"

  const toneDirective = AUTOBLOG_TONES[toneKey].directive
  const lengthDirective = AUTOBLOG_LENGTHS[lengthKey].directive

  const system = [
    "You are the senior content editor for PeptideXM, a research-peptide supplier's blog.",
    "You write factual, non-therapeutic articles for a US research-only audience.",
    "Articles must never recommend human self-administration, never claim to diagnose",
    "or treat disease, and never make unqualified medical promises.",
    "",
    "## Shop catalog (use these EXACT slugs inside [[product:<slug>]] tokens)",
    buildProductCatalogSummary(),
    "",
    "## Voice directive",
    toneDirective,
    "",
    NATURAL_VOICE_GUARDRAIL,
    "",
    "## Length directive",
    lengthDirective,
    "Do not pad to hit the word count — under-run rather than repeat yourself.",
    "",
    "## Output rules",
    "- Output HTML only for the body. No <html>/<body>/<head>/<script>/<style>/inline styles.",
    "- Allowed tags: h2, h3, p, ul, ol, li, blockquote, strong, em, a, hr.",
    "- Start with a short hook paragraph, then H2 sections. Close with a 1–2 sentence summary.",
    "- When a section naturally references a product we sell, insert [[product:<slug>]] on its own line — the site renders it as a product card. Never invent slugs. Never embed more than 2 product tokens in a single post.",
    "- Tags must be lowercase, kebab-case, no leading #.",
    "- All content is for research use only. Never recommend human consumption, dosing, or medical use.",
    "- The slug MUST be derived from the title, lowercase, ASCII, hyphenated.",
  ].join("\n")

  const userPromptLines = [
    `Topic: ${topicRaw}`,
    keywordsRaw ? `Keywords to weave in naturally: ${keywordsRaw}` : "",
    audienceRaw
      ? `Primary reader: ${audienceRaw}`
      : "Primary reader: US-based research-peptide buyer with intermediate biology literacy.",
    "",
    "Write the article now, returning the structured JSON exactly as the schema requires.",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      system,
      prompt: userPromptLines,
      // Higher temperature + nucleus sampling = more varied rhythm and word
      // choice. The structured-output schema still constrains shape, so the
      // extra variance shows up in prose, not in malformed JSON.
      temperature: 0.85,
      topP: 0.92,
      experimental_output: Output.object({ schema: DraftSchema }),
    })

    const draft = result.experimental_output
    if (!draft) {
      return { error: "The AI returned an empty draft. Try again or rephrase your topic." }
    }

    // Defensive post-processing: trim and cap the fields the DB layer also
    // enforces, so validation errors don't ambush the user after they edit.
    const normalized: z.infer<typeof DraftSchema> = {
      title: draft.title.trim().slice(0, 160),
      slug: draft.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80),
      excerpt: draft.excerpt.trim().slice(0, 240),
      content_html: draft.content_html.trim(),
      tags: (draft.tags ?? [])
        .map((t) => t.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
        .filter((t) => t.length > 0)
        .slice(0, 5),
    }

    return { draft: normalized }
  } catch (err) {
    console.log("[v0] autoblog: generation failed", err)
    const msg = err instanceof Error ? err.message : String(err)
    if (/api.*key|unauthor|forbidden/i.test(msg)) {
      return {
        error:
          "AI provider not configured. The Vercel AI Gateway should work zero-config for OpenAI, but this request failed. Check your Vercel AI Gateway settings.",
      }
    }
    return { error: "The AI couldn't generate a draft. Please try again in a moment." }
  }
}

/**
 * Remix an existing article into a PeptideXM draft.
 *
 * The admin pastes a source article (their own research dump, a competitor
 * post, a press release — anything) and we rewrite it in our voice, with
 * our product catalog, safety framing, and structural rules. The output
 * schema and downstream editor wiring are identical to the topic generator
 * above — only the system/user prompts differ.
 *
 * Anti-plagiarism posture: the prompt is explicit that the model must
 * *synthesize and rewrite*, not paraphrase sentence-by-sentence. We're
 * counting on the LLM here, not a similarity checker — the admin still
 * reviews the output before publishing.
 */
export async function remixBlogDraftAction(formData: FormData): Promise<DraftResult> {
  try {
    await requireAdmin()
  } catch (err) {
    console.log("[v0] autoblog remix: requireAdmin failed", err)
    return { error: "You must be signed in as an admin to remix articles." }
  }

  const sourceRaw = String(formData.get("source") ?? "").trim()
  const sourceUrlRaw = String(formData.get("source_url") ?? "").trim()
  const focusRaw = String(formData.get("focus") ?? "").trim()
  const keywordsRaw = String(formData.get("keywords") ?? "").trim()
  const audienceRaw = String(formData.get("audience") ?? "").trim()
  const toneRaw = String(formData.get("tone") ?? "research").trim()
  const lengthRaw = String(formData.get("length") ?? "medium").trim()

  if (!sourceRaw) return { error: "Paste the source article in the Source field first." }
  if (sourceRaw.length < 200) {
    return { error: "Source is too short to remix — paste the full article (at least a few paragraphs)." }
  }
  // Hard ceiling so we don't blow the context window. Articles longer than
  // this get truncated with a notice appended; the model still gets the
  // opening + body + a tail signal that we cut off.
  const MAX_SOURCE = 60_000
  const sourceTrimmed =
    sourceRaw.length > MAX_SOURCE
      ? sourceRaw.slice(0, MAX_SOURCE) + "\n\n[...source truncated for length...]"
      : sourceRaw

  if (sourceUrlRaw.length > 400) return { error: "Source URL is too long." }
  if (focusRaw.length > 400) return { error: "Focus note is too long. Keep it under 400 characters." }
  if (keywordsRaw.length > 400) return { error: "Keyword list is too long. Keep it under 400 characters." }
  if (audienceRaw.length > 200) return { error: "Audience description is too long. Keep it under 200 characters." }

  const toneKey: AutoblogTone = (TONE_KEYS as readonly string[]).includes(toneRaw)
    ? (toneRaw as AutoblogTone)
    : "research"
  const lengthKey: AutoblogLength = (LENGTH_KEYS as readonly string[]).includes(lengthRaw)
    ? (lengthRaw as AutoblogLength)
    : "medium"

  const toneDirective = AUTOBLOG_TONES[toneKey].directive
  const lengthDirective = AUTOBLOG_LENGTHS[lengthKey].directive

  const system = [
    "You are the senior content editor for PeptideXM, a research-peptide supplier's blog.",
    "The admin has given you a SOURCE ARTICLE and wants a fresh, publishable post that",
    "covers similar ground in OUR voice, for OUR audience, with OUR product framing.",
    "",
    "## Hard rules",
    "- Do NOT copy sentences or paragraphs verbatim. Rewrite everything in your own words.",
    "- Do NOT paraphrase sentence-by-sentence. Restructure: reorder sections, merge ideas, drop fluff, add our angle.",
    "- Treat the source as *reference material* — extract facts, claims, and structure, then write anew.",
    "- Remove any therapeutic/medical claims, dosing instructions, or self-administration language from the source.",
    "  Replace with neutral, research-only framing.",
    "- Never attribute claims to the original author. Never mention or link the source.",
    "- All content is for research use only. Never recommend human consumption.",
    "",
    "## Shop catalog (use these EXACT slugs inside [[product:<slug>]] tokens)",
    buildProductCatalogSummary(),
    "",
    "## Voice directive",
    toneDirective,
    "",
    NATURAL_VOICE_GUARDRAIL,
    "",
    "## Length directive",
    lengthDirective,
    "Do not pad to hit the word count — under-run rather than repeat yourself.",
    "",
    "## Output rules",
    "- Output HTML only for the body. No <html>/<body>/<head>/<script>/<style>/inline styles.",
    "- Allowed tags: h2, h3, p, ul, ol, li, blockquote, strong, em, a, hr.",
    "- Start with a short hook paragraph, then H2 sections. Close with a 1–2 sentence summary.",
    "- When a section naturally references a product we sell, insert [[product:<slug>]] on its own line. Never invent slugs. Max 2 per post.",
    "- Tags must be lowercase, kebab-case, no leading #.",
    "- The slug MUST be derived from the title, lowercase, ASCII, hyphenated. Do NOT reuse the source's slug or headline verbatim.",
  ].join("\n")

  const userPromptLines = [
    sourceUrlRaw ? `Source URL (for your context only — do not link or mention it): ${sourceUrlRaw}` : "",
    focusRaw ? `Our angle / what to emphasize in the remix: ${focusRaw}` : "",
    keywordsRaw ? `Keywords to weave in naturally: ${keywordsRaw}` : "",
    audienceRaw
      ? `Primary reader: ${audienceRaw}`
      : "Primary reader: US-based research-peptide buyer with intermediate biology literacy.",
    "",
    "=== SOURCE ARTICLE BEGIN ===",
    sourceTrimmed,
    "=== SOURCE ARTICLE END ===",
    "",
    "Now write the remixed article in our voice, returning the structured JSON exactly as the schema requires.",
    "Remember: synthesize, don't paraphrase. The title, slug, headings, and phrasing should all be original.",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      system,
      prompt: userPromptLines,
      // Same sampling as the topic drafter — variance in prose, not shape.
      temperature: 0.85,
      topP: 0.92,
      experimental_output: Output.object({ schema: DraftSchema }),
    })

    const draft = result.experimental_output
    if (!draft) {
      return { error: "The AI returned an empty draft. Try again or trim the source." }
    }

    const normalized: z.infer<typeof DraftSchema> = {
      title: draft.title.trim().slice(0, 160),
      slug: draft.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80),
      excerpt: draft.excerpt.trim().slice(0, 240),
      content_html: draft.content_html.trim(),
      tags: (draft.tags ?? [])
        .map((t) => t.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
        .filter((t) => t.length > 0)
        .slice(0, 5),
    }

    return { draft: normalized }
  } catch (err) {
    console.log("[v0] autoblog remix: generation failed", err)
    const msg = err instanceof Error ? err.message : String(err)
    if (/api.*key|unauthor|forbidden/i.test(msg)) {
      return {
        error:
          "AI provider not configured. The Vercel AI Gateway should work zero-config for OpenAI, but this request failed. Check your Vercel AI Gateway settings.",
      }
    }
    if (/context|token|too.*long/i.test(msg)) {
      return { error: "Source is too long for the model. Trim it to the key sections and try again." }
    }
    return { error: "The AI couldn't remix the source. Please try again in a moment." }
  }
}
