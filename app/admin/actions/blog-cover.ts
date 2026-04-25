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
 * cover ends up *different*. The previous version of this action
 * hardcoded "editorial / scientific magazine style, soft lighting,
 * muted palette" into every call, which is exactly why every
 * generated cover looked the same.
 */
const SAFETY_CONSTRAINTS = [
  "16:9 landscape aspect ratio.",
  "Do NOT include any text, captions, watermarks, logos, letters, or numbers.",
  "Do NOT include human faces or recognizable people.",
  "Do NOT include needles, syringes, pills, or medical paraphernalia (this is a research-chemistry blog cover, not a clinical product photo).",
].join(" ")

/**
 * Trim post body to a budget of ~600 chars of meaningful prose so the
 * expander LLM has *substance* to work with without paying for a full
 * 3000-word dump. We strip markdown noise (headings, asterisks, link
 * URLs, code fences) so the model sees the actual subject matter, not
 * formatting artifacts.
 */
function condensePostBody(body: string | undefined | null, max = 600): string {
  if (!body) return ""
  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/`[^`]+`/g, " ") // inline code
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ") // images
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1") // links → keep label
    .replace(/^#{1,6}\s+/gm, "") // heading markers
    .replace(/[*_>#~]/g, " ") // remaining markdown punctuation
    .replace(/\s+/g, " ")
    .trim()
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max).replace(/\s+\S*$/, "") + "…"
}

/**
 * Internal: turn (post context + optional admin brief) into a rich,
 * topic-specific image prompt via gpt-5-mini.
 *
 * The whole point is to break the "every cover looks the same"
 * pattern: the LLM picks subject, palette, framing, and mood
 * appropriate to *this specific post*, and it picks something
 * different every call (LLM stochasticity is a feature here).
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

  // If we genuinely have nothing to work with, give up gracefully
  // rather than asking the LLM to invent a topic from thin air.
  if (!briefClean && !titleClean && !excerptClean && !bodyClean) return null

  const system = [
    "You are an art director writing image-generation prompts for blog cover art on a research-peptide editorial site (PeptideXM).",
    "Each prompt must be VISUALLY SPECIFIC and DIFFERENT from a generic 'science photo'.",
    "Pick ONE concrete visual concept that metaphorically represents the post's subject — e.g. molecular crystallography seen through a prism, a single lab-grown specimen lit by amber rim light, an abstract ribbon model rendered in cinema-quality glass, an ink-in-water diffusion suggesting receptor binding.",
    "Vary your stylistic choices across calls (palette, lens, lighting, medium). Avoid clichés like 'glowing blue DNA helix on dark background'.",
    "Be specific about: (1) the central subject, (2) palette (name 2–3 actual colors), (3) lighting / time-of-day, (4) lens or medium (e.g. macro photograph, oil painting, 3D render, wet-plate), (5) composition (rule of thirds? centered? off-axis?).",
    "Do not mention text, words, logos, faces, syringes, or pills — those are filtered separately.",
    "Output ONLY the prompt as a single paragraph of 2–4 sentences. No preamble, no quotes, no markdown.",
  ].join(" ")

  const userParts: string[] = []
  if (titleClean) userParts.push(`Post title: ${titleClean}`)
  if (excerptClean) userParts.push(`Excerpt: ${excerptClean}`)
  if (tagsClean.length) userParts.push(`Tags: ${tagsClean.join(", ")}`)
  if (bodyClean) userParts.push(`Body excerpt: ${bodyClean}`)
  if (briefClean) userParts.push(`Art-director note from the editor: ${briefClean}`)
  userParts.push(
    "Write the cover-art prompt now. Make it concrete, evocative, and clearly tied to this post's actual subject matter.",
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
 *   1. If post context is present, run the admin's brief through the
 *      LLM expander to produce a varied, topic-specific prompt. If
 *      the brief is already long and detailed (>240 chars) we use it
 *      verbatim — assume the admin has written exactly what they want.
 *   2. Append the immutable safety constraints (16:9, no text, no
 *      people, no medical paraphernalia).
 *   3. Send to `google/gemini-3.1-flash-image-preview` (Nano Banana)
 *      via the Vercel AI Gateway.
 *   4. Upload the resulting PNG into the existing `blog-images`
 *      Supabase Storage bucket (shared with manual uploads, so
 *      AI-generated covers inherit the same public-URL/RLS posture).
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
  if (promptRaw.length > 1000) {
    return { error: "Prompt is too long. Keep it under 1000 characters." }
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

  // Decide whether to run the expander. Skip it when the admin has
  // clearly written a thorough prompt of their own — no need to
  // second-guess a 300-character art direction. Also skip when we
  // have no post context at all.
  const hasContext = !!(title || excerpt || tags.length || body)
  const adminPromptLooksDetailed = promptRaw.length >= 240

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

  const finalPrompt = `${mainPrompt}\n\nConstraints: ${SAFETY_CONSTRAINTS}`

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
