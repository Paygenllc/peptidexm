"use server"

import { generateText, Output } from "ai"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/require-admin"
import { products, productSlug } from "@/lib/products-catalog"

/**
 * Autoblog: generate a blog post draft from a topic.
 *
 * Uses the Vercel AI Gateway (zero-config for openai/gpt-5-mini) and the
 * `Output.object()` pattern to get a strictly-typed structured response.
 *
 * The system prompt:
 *   - Teaches the model what our shop sells (so embedded product tokens
 *     like `[[product:bpc-157]]` resolve to real products).
 *   - Enforces a research-tone voice consistent with the existing blog.
 *   - Produces HTML (matching the TipTap rich editor output) so the
 *     generated draft drops straight into the editor and renders
 *     identically to human-written posts.
 *
 * We use `nullable()` instead of `optional()` on the schema fields
 * because OpenAI strict mode requires every property to be present.
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
        "Structure: opening paragraph, 3-6 H2 sections, each with 1-3 paragraphs and optionally a bulleted list, closing summary paragraph.",
    ),
  tags: z
    .array(z.string())
    .describe("Up to 5 short topical tags (lowercase, kebab-case, no hashes, no duplicates)"),
})

type DraftResult =
  | { draft: z.infer<typeof DraftSchema> }
  | { error: string }

function buildProductCatalogSummary(): string {
  // Keep the system prompt payload small: name + slug + one-line category is
  // enough for the model to pick relevant products without burning tokens on
  // pricing or variant data it can't use in post body anyway.
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
  const tone = String(formData.get("tone") ?? "research").trim()
  const lengthRaw = String(formData.get("length") ?? "medium").trim()

  if (!topicRaw) {
    return { error: "Enter a topic for the AI to write about." }
  }
  if (topicRaw.length > 500) {
    return { error: "Topic is too long. Keep it under 500 characters." }
  }

  const lengthGuidance: Record<string, string> = {
    short: "Target ~500-700 words (3 H2 sections).",
    medium: "Target ~900-1200 words (4-5 H2 sections).",
    long: "Target ~1500-2000 words (5-6 H2 sections).",
  }
  const toneGuidance: Record<string, string> = {
    research:
      "Measured, evidence-led, research-blog voice. Avoid marketing fluff. Do not prescribe dosing or make therapeutic claims — this is research-use content only.",
    educational:
      "Plain-English explainer voice. Clear, structured, teaches the reader a mechanism or concept. Research-use framing only.",
    news:
      "Timely research-news brief. Summarize what's new, why it matters for researchers, and point to next directions. Research-use framing only.",
  }

  const system = `You are an expert science writer for PeptideXM, a research peptide supplier's blog.

## Shop catalog (use these exact slugs)
${buildProductCatalogSummary()}

## Voice
${toneGuidance[tone] ?? toneGuidance.research}

## Length
${lengthGuidance[lengthRaw] ?? lengthGuidance.medium}

## Rules
- Output HTML only for the body. No <html>/<body>/<head>/<script>/<style>/inline styles.
- Allowed tags: h2, h3, p, ul, ol, li, blockquote, strong, em, a, hr.
- Start with a short hook paragraph, then H2 sections. Close with a 1-2 sentence summary.
- When a section naturally references a specific product we sell, insert the token [[product:<slug>]] on its own line — the site renders it as a product card. Never invent slugs. Never embed more than 2 product tokens in a single post.
- Tags must be lowercase, kebab-case, no leading #.
- All content is for research use only. Never recommend human consumption, dosing, or medical use.
- The slug MUST be derived from the title, lowercase, ascii, hyphenated.`

  try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      system,
      prompt: `Write a blog post on this topic: "${topicRaw}"`,
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
