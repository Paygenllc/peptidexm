"use server"

import { generateText } from "ai"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { applyBrandWatermark } from "@/lib/watermark"

type CoverResult = { url: string } | { error: string }
type SuggestResult = { prompt: string } | { error: string }

/**
 * Hard, non-negotiable constraints we always enforce on the image
 * model regardless of what the admin (or the LLM expander) wrote.
 *
 * Kept deliberately short — anything stylistic (palette, mood,
 * subject framing, lighting) is left to the LLM expander so each
 * cover ends up *different*. Stylistic locks here are exactly why
 * earlier versions of this action produced near-identical covers.
 */
const SAFETY_CONSTRAINTS = [
  "16:9 landscape aspect ratio.",
  "Do NOT include any text, captions, watermarks, logos, letters, or numbers — the image must be pure visual.",
  "Do NOT include human faces or recognizable people.",
  "Do NOT include needles, syringes, pills, blister packs, or clinical product packaging — this is an editorial research-chemistry blog cover, not a pharma ad.",
  "Photorealistic editorial quality, sharp focus on the primary subject, professional studio or scientific lighting.",
].join(" ")

/**
 * Pull a meaningful slice of the post body for the prompt expander.
 *
 * We strip markdown noise so the model sees prose, not asterisks,
 * then return the first ~1500 chars (was 600 — too thin for
 * technical posts whose subject lives a few paragraphs in). We also
 * keep H2 headings inline as `[H2: ...]` markers so the LLM can
 * weight them: heading text is almost always closer to the post's
 * actual subject than the intro paragraph, which is usually
 * narrative throat-clearing.
 */
function condensePostBody(body: string | undefined | null, max = 1500): string {
  if (!body) return ""
  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/`[^`]+`/g, " ") // inline code
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ") // images
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1") // links → keep label
    .replace(/^##\s+(.+)$/gm, "[H2: $1]") // surface section headings
    .replace(/^#{1,6}\s+/gm, "") // strip remaining heading markers
    .replace(/[*_>~]/g, " ") // remaining markdown punctuation
    .replace(/\s+/g, " ")
    .trim()
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max).replace(/\s+\S*$/, "") + "…"
}

/**
 * Heuristically lift "subject anchor" tokens (peptide names,
 * receptor names, study terms) out of the post so we can hand them
 * to the LLM as an explicit subject vocabulary. Image models are
 * notoriously bad at inferring obscure scientific subjects from
 * loose prose; spelling out "the cover should depict GLP-1
 * receptor activity" works far better than hoping it picks that
 * up from a passing mention.
 *
 * Strategy: collect words that look like proper nouns (CamelCase,
 * ALLCAPS abbreviations, hyphenated chemical names like BPC-157)
 * from title + body, dedupe, and keep the most frequent 6.
 */
function extractSubjectAnchors(title: string, body: string): string[] {
  const corpus = `${title} ${body}`
  // Match: ALLCAPS (3+), Camel/Title-cased words, hyphenated chem
  // identifiers (e.g. BPC-157, GHK-Cu, CJC-1295).
  const matches = corpus.match(/\b([A-Z]{2,}(?:-\d+)?|[A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z]+-\d+)\b/g) ?? []
  const counts = new Map<string, number>()
  for (const tok of matches) {
    // Skip stop-words that look proper-noun-ish to the regex.
    if (/^(The|This|That|These|Those|And|But|However|Although|While)$/.test(tok)) continue
    counts.set(tok, (counts.get(tok) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t)
}

/**
 * Internal: turn (post context + optional admin brief) into a
 * topic-specific image prompt via gpt-5-mini.
 *
 * Goal #1 here is **subject fidelity** — the cover must clearly
 * depict whatever the post is about. An earlier version of this
 * function asked the LLM to "metaphorically represent" the post,
 * which is exactly how you end up with abstract glass ribbons on
 * an article about clinical trial endpoints. The system prompt
 * below now leads with literal subject matching, then layers
 * style on top.
 *
 * If the LLM call fails for any reason we return null and let the
 * caller fall back to whatever the admin typed — the cover-gen
 * pipeline must never be blocked by the expander.
 */
async function expandPromptWithContext(args: {
  brief?: string
  title?: string
  excerpt?: string
  tags?: string[]
  body?: string
}): Promise<string | null> {
  const briefClean = (args.brief ?? "").trim()
  const titleClean = (args.title ?? "").trim()
  const excerptClean = (args.excerpt ?? "").trim()
  const tagsClean = (args.tags ?? []).map((t) => t.trim()).filter(Boolean)
  const bodyClean = condensePostBody(args.body)
  const anchors = extractSubjectAnchors(titleClean, bodyClean)

  // If we genuinely have nothing to work with, give up gracefully
  // rather than asking the LLM to invent a topic from thin air.
  if (!briefClean && !titleClean && !excerptClean && !bodyClean) return null

  const system = [
    "You are an art director writing image-generation prompts for blog cover art on PeptideXM, an editorial research-peptide journal.",
    "",
    "Your single most important job is SUBJECT FIDELITY: the cover must clearly depict the post's actual subject — the specific peptide, molecule, biological system, lab technique, or research domain the article is about. A reader scrolling the blog index should be able to guess the post's topic from the cover alone.",
    "",
    "Process (do this silently, do not output it):",
    "  1. Identify the post's primary concrete subject in one sentence (e.g. 'the peptide BPC-157 and its tissue-repair mechanism', 'a GLP-1 receptor binding event', 'collagen fibril structure under electron microscopy').",
    "  2. Choose a literal visual representation of that subject that a science illustrator would actually draw — molecular ribbon model, cellular cross-section, lab specimen on a stage, microscopy field, biochemical diagram, etc. Avoid abstract or purely metaphorical interpretations.",
    "  3. Layer editorial styling on top: pick a palette (name 2–3 actual colors), a lighting setup, a lens or medium (macro photograph, 3D render, scientific illustration, oil painting), and a composition.",
    "",
    "Stylistic variety: vary palette, lighting, and medium across calls so the blog index doesn't become visually monotonous — but NEVER trade subject accuracy for variety. A varied cover that misses the topic is worse than a samey cover that hits it.",
    "",
    "Hard rules: do not mention text, words, captions, logos, faces, syringes, pills, or product packaging. Do not invent symbolic objects unrelated to the subject (no 'glowing orbs', no 'mysterious silhouettes', no 'flowing ribbons of light' unless they are literally what the post is about).",
    "",
    "Output ONLY the prompt as a single paragraph of 3–5 sentences. Lead with the subject. No preamble, no quotes, no markdown.",
  ].join("\n")

  const userParts: string[] = []
  if (titleClean) userParts.push(`POST TITLE: ${titleClean}`)
  if (excerptClean) userParts.push(`EXCERPT: ${excerptClean}`)
  if (tagsClean.length) userParts.push(`TAGS: ${tagsClean.join(", ")}`)
  if (anchors.length) {
    userParts.push(
      `SUBJECT ANCHORS (proper nouns lifted from the post — the cover should center on one or more of these): ${anchors.join(", ")}`,
    )
  }
  if (bodyClean) userParts.push(`BODY EXCERPT (markdown stripped, [H2: …] markers indicate section headings):\n${bodyClean}`)
  if (briefClean) userParts.push(`ART-DIRECTOR NOTE FROM THE EDITOR: ${briefClean}`)
  userParts.push(
    "Write the cover-art prompt now. Lead with the literal subject from this specific post. Make it concrete and visually specific.",
  )

  try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      system,
      prompt: userParts.join("\n\n"),
    })
    const text = result.text?.trim()
    if (!text) return null
    // Defensive: strip surrounding quotes the model sometimes adds.
    return text.replace(/^["'`]+|["'`]+$/g, "").trim() || null
  } catch (err) {
    console.log("[v0] blog-cover: prompt expansion failed", err)
    return null
  }
}

/**
 * Public action: produce a suggested cover prompt from the post's
 * own context. Called by the editor's "Suggest from post" button so
 * the admin can review (and edit) the expanded prompt before it
 * goes to the image model.
 */
export async function suggestBlogCoverPromptAction(input: {
  title?: string
  excerpt?: string
  tags?: string[]
  body?: string
  brief?: string
}): Promise<SuggestResult> {
  try {
    await requireAdmin()
  } catch (err) {
    console.log("[v0] suggest-cover: requireAdmin failed", err)
    return { error: "You must be signed in as an admin." }
  }

  const expanded = await expandPromptWithContext(input)
  if (!expanded) {
    return {
      error:
        "Couldn't draft a prompt — add a title, excerpt, or a few sentences of body content first.",
    }
  }
  return { prompt: expanded }
}

/**
 * Generate a cover image for a blog post.
 *
 * Pipeline:
 *   1. If post context is present AND the admin's brief is short
 *      (<240 chars), run it through the LLM expander to produce a
 *      varied, topic-specific prompt. Long detailed briefs (>=240
 *      chars) and prompts that came directly from `Suggest from
 *      post` (>=120 chars and contain a subject anchor) pass through
 *      verbatim — re-expanding them would play telephone with the
 *      admin's intent.
 *   2. Append the immutable safety constraints (16:9, no text, no
 *      people, no medical paraphernalia, photoreal editorial).
 *   3. Send to `google/gemini-3.1-flash-image-preview` (Nano Banana)
 *      via the Vercel AI Gateway.
 *   4. Watermark + upload into the existing `blog-images` Supabase
 *      Storage bucket (shared with manual uploads).
 */
export async function generateBlogCoverAction(formData: FormData): Promise<CoverResult> {
  try {
    await requireAdmin()
  } catch (err) {
    console.log("[v0] blog-cover: requireAdmin failed", err)
    return { error: "You must be signed in as an admin to generate images." }
  }

  const promptRaw = String(formData.get("prompt") ?? "").trim()
  if (!promptRaw) return { error: "Describe the image you want." }
  if (promptRaw.length > 1500) {
    return { error: "Prompt is too long. Keep it under 1500 characters." }
  }

  // Optional post-context fields. Their presence flips us from
  // "trust the admin's prompt verbatim" mode to "expand with LLM"
  // mode. The editor always sends them; older callers (if any)
  // simply skip them and behave like before.
  const title = String(formData.get("title") ?? "").trim()
  const excerpt = String(formData.get("excerpt") ?? "").trim()
  const tagsRaw = String(formData.get("tags") ?? "").trim()
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : []
  const body = String(formData.get("body") ?? "").trim()

  // Decide whether to re-run the expander. The editor's "Suggest"
  // button already runs it once; if the admin clicks Generate
  // straight after, the prompt in the textarea is already a
  // multi-sentence subject-led prompt and we shouldn't paraphrase
  // it again. We use length AS WELL AS a content heuristic — if it
  // contains one of the post's subject anchors, it's almost
  // certainly a Suggest result and should pass through.
  const hasContext = !!(title || excerpt || tags.length || body)
  const anchors = extractSubjectAnchors(title, condensePostBody(body))
  const promptHasAnchor =
    anchors.length > 0 && anchors.some((a) => promptRaw.toLowerCase().includes(a.toLowerCase()))
  const adminPromptLooksDetailed = promptRaw.length >= 240 || (promptRaw.length >= 120 && promptHasAnchor)

  let mainPrompt = promptRaw
  if (hasContext && !adminPromptLooksDetailed) {
    const expanded = await expandPromptWithContext({
      brief: promptRaw,
      title,
      excerpt,
      tags,
      body,
    })
    if (expanded) mainPrompt = expanded
    // If expansion failed we fall through with the raw admin prompt;
    // generation is still attempted so the admin isn't stranded.
  }

  // Surface the post title to the image model as a tiny anchor line
  // even when the admin wrote a verbatim prompt — it's a cheap
  // accuracy boost that helps the model when the prompt body is
  // stylistic rather than topical.
  const titleAnchor = title ? `\n\nThis cover illustrates a blog post titled: "${title}".` : ""

  const finalPrompt = `${mainPrompt}${titleAnchor}\n\nHard constraints: ${SAFETY_CONSTRAINTS}`

  let imageBytes: Uint8Array | null = null
  let mediaType = "image/png"

  try {
    const result = await generateText({
      model: "google/gemini-3.1-flash-image-preview",
      prompt: finalPrompt,
    })

    // The model interleaves text + images; we only want the first image.
    const file = result.files?.find((f) => f.mediaType?.startsWith("image/"))
    if (!file) {
      console.log("[v0] blog-cover: model returned no image file", {
        files: result.files?.length ?? 0,
        text: result.text?.slice(0, 200),
      })
      return {
        error:
          "The AI didn't return an image. Try rephrasing — concrete subjects and lighting cues work best.",
      }
    }

    imageBytes = file.uint8Array
    mediaType = file.mediaType ?? "image/png"
  } catch (err) {
    console.log("[v0] blog-cover: generation failed", err)
    const msg = err instanceof Error ? err.message : String(err)
    if (/api.*key|unauthor|forbidden|not.*configured/i.test(msg)) {
      return {
        error:
          "Image generation isn't configured. Gemini image models route through the Vercel AI Gateway — check your gateway settings.",
      }
    }
    if (/safety|policy|blocked/i.test(msg)) {
      return { error: "The prompt was blocked by the model's safety filters. Try rephrasing." }
    }
    return { error: "The AI couldn't generate an image. Please try again." }
  }

  // Brand the cover with the peptidexm.com wordmark. We do this on
  // the server (never in the browser) so the bytes that hit Storage
  // are already watermarked — there's no window in which an
  // unbranded version of the image is reachable via its public URL.
  // If watermarking fails for any reason we still upload the raw
  // image rather than aborting the whole generation; a missing
  // watermark is recoverable, a lost cover after a 30-second
  // generate is not.
  let finalBytes = imageBytes
  let finalMediaType = mediaType
  let finalExt = mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png"
  try {
    finalBytes = await applyBrandWatermark(imageBytes)
    // applyBrandWatermark always re-encodes to PNG, so pin the
    // mime/extension to match what's actually on disk.
    finalMediaType = "image/png"
    finalExt = "png"
  } catch (err) {
    console.log("[v0] blog-cover: watermark failed; uploading un-watermarked copy", err)
  }

  // Upload into the existing blog-images bucket (shared with manual uploads).
  const admin = createAdminClient()
  const path = `covers/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${finalExt}`

  const { error: upErr } = await admin.storage
    .from("blog-images")
    .upload(path, finalBytes, {
      contentType: finalMediaType,
      upsert: false,
    })

  if (upErr) {
    console.log("[v0] blog-cover: storage upload failed", upErr)
    return { error: "Couldn't save the generated image. Please try again." }
  }

  const { data } = admin.storage.from("blog-images").getPublicUrl(path)
  return { url: data.publicUrl }
}
