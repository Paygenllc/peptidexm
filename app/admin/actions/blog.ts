"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { sanitizePostContent } from "@/lib/sanitize"
import { revalidatePath } from "next/cache"

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const supabase = await createClient()
  const safeBase = base || "post"
  // Bound the search so a misconfigured DB can never hang a server action.
  // 50 collisions on the same base is already pathological — bail out
  // with a timestamp suffix rather than spin forever.
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? safeBase : `${safeBase}-${n}`
    // Build a fresh query every iteration: Supabase PostgrestBuilders are
    // one-shot thenables — once awaited they can't be re-run, and mutating
    // them across loop iterations silently reuses the old filter. Previous
    // code did exactly that, which is why the second+ post whose slug
    // collided with an existing one was crashing the action.
    let query = supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", candidate)
      .limit(1)
    if (excludeId) query = query.neq("id", excludeId)
    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) return candidate
  }
  return `${safeBase}-${Date.now()}`
}

/**
 * Revalidate one or more paths without allowing a single failure to tank
 * the whole action. `revalidatePath` can throw in edge cases (missing
 * page, wrong cache mode, etc.) — those failures shouldn't roll back
 * a successfully-inserted post.
 */
function safeRevalidate(paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch (err) {
      console.log("[v0] blog revalidate failed:", p, err)
    }
  }
}

/**
 * Create a blog post. If `status === "published"` and no `published_at` has
 * been set, timestamp it now so the public feed orders it correctly.
 *
 * Every path through this action returns `{ error }` or `{ success, id }` —
 * we never throw. Throws would surface in the client editor's
 * `startTransition` as an unhandled rejection and blow up the RSC render
 * on the redirect target with a cryptic "Server Components render" error.
 */
export async function createBlogPostAction(formData: FormData) {
  try {
    const { user } = await requireAdmin()

    const title = String(formData.get("title") || "").trim()
    const slugInput = String(formData.get("slug") || "").trim()
    const excerpt = String(formData.get("excerpt") || "").trim()
    const content = String(formData.get("content_markdown") || "").trim()
    const coverImage = String(formData.get("cover_image_url") || "").trim()
    const tagsRaw = String(formData.get("tags") || "")
    const status = String(formData.get("status") || "draft")

    if (!title) return { error: "Title is required" }
    if (!content) return { error: "Content is required" }

    const slug = await uniqueSlug(slugify(slugInput || title))
    const tags = parseTags(tagsRaw)
    const safeContent = await sanitizePostContent(content)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        slug,
        title,
        excerpt: excerpt || null,
        content_markdown: safeContent,
        cover_image_url: coverImage || null,
        tags,
        status,
        author_id: user.id,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .select("id")
      .single()

    if (error) {
      console.log("[v0] blog insert error:", error)
      return { error: error.message }
    }
    if (!data?.id) {
      return { error: "Post was created but no id was returned." }
    }

    safeRevalidate(["/admin/blog", "/blog"])

    // Return the new post id and let the client navigate. Calling
    // redirect() from a server action awaited in startTransition causes
    // the client promise to resolve with undefined, which breaks the
    // editor's response handling.
    return { success: true as const, id: data.id }
  } catch (err) {
    // NEXT_REDIRECT is how redirect() works — rethrow so Next handles it.
    const msg = err instanceof Error ? err.message : String(err)
    if (/NEXT_REDIRECT/i.test(msg)) throw err
    console.log("[v0] createBlogPostAction threw:", err)
    return { error: msg || "Could not create the post." }
  }
}

export async function updateBlogPostAction(formData: FormData) {
  try {
    await requireAdmin()

    const id = String(formData.get("id") || "")
    const title = String(formData.get("title") || "").trim()
    const slugInput = String(formData.get("slug") || "").trim()
    const excerpt = String(formData.get("excerpt") || "").trim()
    const content = String(formData.get("content_markdown") || "").trim()
    const coverImage = String(formData.get("cover_image_url") || "").trim()
    const tagsRaw = String(formData.get("tags") || "")
    const status = String(formData.get("status") || "draft")

    if (!id) return { error: "Missing id" }
    if (!title) return { error: "Title is required" }
    if (!content) return { error: "Content is required" }

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("slug, status, published_at")
      .eq("id", id)
      .single()
    if (!existing) return { error: "Post not found" }

    const nextBase = slugify(slugInput || title)
    const slug =
      existing.slug === nextBase || !nextBase
        ? existing.slug
        : await uniqueSlug(nextBase, id)

    const wasPublished = existing.status === "published"
    const isPublished = status === "published"
    const publishedAt =
      isPublished && !wasPublished
        ? new Date().toISOString() // just published
        : isPublished
          ? existing.published_at // already published, keep timestamp
          : null // back to draft, clear the timestamp

    const tags = parseTags(tagsRaw)
    const safeContent = await sanitizePostContent(content)

    const { error } = await supabase
      .from("blog_posts")
      .update({
        slug,
        title,
        excerpt: excerpt || null,
        content_markdown: safeContent,
        cover_image_url: coverImage || null,
        tags,
        status,
        published_at: publishedAt,
      })
      .eq("id", id)

    if (error) {
      console.log("[v0] blog update error:", error)
      return { error: error.message }
    }

    safeRevalidate([
      "/admin/blog",
      `/admin/blog/${id}`,
      "/blog",
      `/blog/${slug}`,
      ...(existing.slug !== slug ? [`/blog/${existing.slug}`] : []),
    ])

    return { success: true as const, slug }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/NEXT_REDIRECT/i.test(msg)) throw err
    console.log("[v0] updateBlogPostAction threw:", err)
    return { error: msg || "Could not save the post." }
  }
}

export async function deleteBlogPostAction(formData: FormData) {
  try {
    await requireAdmin()
    const id = String(formData.get("id") || "")
    if (!id) return { error: "Missing id" }

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("id", id)
      .single()

    const { error } = await supabase.from("blog_posts").delete().eq("id", id)
    if (error) {
      console.log("[v0] blog delete error:", error)
      return { error: error.message }
    }

    safeRevalidate([
      "/admin/blog",
      "/blog",
      ...(existing?.slug ? [`/blog/${existing.slug}`] : []),
    ])
    // Same pattern as create: let the client navigate so we don't trip
    // the `"error" in undefined` trap in the editor's response handler.
    return { success: true as const, deleted: true as const }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/NEXT_REDIRECT/i.test(msg)) throw err
    console.log("[v0] deleteBlogPostAction threw:", err)
    return { error: msg || "Could not delete the post." }
  }
}
