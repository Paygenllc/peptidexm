"use server"

import { generateText } from "ai"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

type CoverResult = { url: string } | { error: string }

/**
 * Generate a cover image for a blog post from a natural-language prompt.
 *
 * Pipeline:
 *   1. `generateText` with `google/gemini-3.1-flash-image-preview`
 *      (aka Nano Banana) — zero-config via the Vercel AI Gateway. The
 *      multi-modal model returns image data in `result.files`.
 *   2. The PNG buffer is uploaded into the existing `blog-images` Supabase
 *      Storage bucket via the admin client. We reuse that bucket so
 *      AI-generated covers share the same public-URL, cache, and RLS
 *      posture as manually-uploaded ones.
 *
 * Why server-side upload: the model data is a raw PNG buffer the server
 * already holds — round-tripping it through the browser just to re-upload
 * would double bandwidth and require an extra RLS policy for authenticated
 * uploads. Uploading with the service-role key keeps the flow atomic.
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

  // Compose a system-style preamble so every AI-generated cover has a
  // consistent look: wide aspect, editorial/scientific feel, no text
  // overlays (readability on card + OG previews), and no people (safest
  // for a research-peptide brand). The admin's prompt is appended.
  const finalPrompt = [
    "Generate a single landscape blog cover image, 16:9 aspect ratio,",
    "high detail, cinematic lighting, editorial / scientific magazine style.",
    "No text, captions, watermarks, or logos. No human faces.",
    "Subject:",
    promptRaw,
  ].join(" ")

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

  // Upload into the existing blog-images bucket (shared with manual uploads).
  const admin = createAdminClient()
  const ext = mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png"
  const path = `covers/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: upErr } = await admin.storage
    .from("blog-images")
    .upload(path, imageBytes, {
      contentType: mediaType,
      upsert: false,
    })

  if (upErr) {
    console.log("[v0] blog-cover: storage upload failed", upErr)
    return { error: "Couldn't save the generated image. Please try again." }
  }

  const { data } = admin.storage.from("blog-images").getPublicUrl(path)
  return { url: data.publicUrl }
}
