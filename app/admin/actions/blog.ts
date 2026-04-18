"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

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
  let candidate = base || "post"
  let n = 1
  while (true) {
    const q = supabase.from("blog_posts").select("id").eq("slug", candidate).limit(1)
    const { data } = excludeId ? await q.neq("id", excludeId) : await q
    if (!data || data.length === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
}

/**
 * Create a blog post. If `status === "published"` and no `published_at` has
 * been set, timestamp it now so the public feed orders it correctly.
 */
export async function createBlogPostAction(formData: FormData) {
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

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      slug,
      title,
      excerpt: excerpt || null,
      content_markdown: content,
      cover_image_url: coverImage || null,
      tags,
      status,
      author_id: user.id,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  redirect(`/admin/blog/${data.id}`)
}

export async function updateBlogPostAction(formData: FormData) {
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

  const { error } = await supabase
    .from("blog_posts")
    .update({
      slug,
      title,
      excerpt: excerpt || null,
      content_markdown: content,
      cover_image_url: coverImage || null,
      tags,
      status,
      published_at: publishedAt,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin/blog")
  revalidatePath(`/admin/blog/${id}`)
  revalidatePath("/blog")
  revalidatePath(`/blog/${slug}`)
  if (existing.slug !== slug) revalidatePath(`/blog/${existing.slug}`)

  return { success: true, slug }
}

export async function deleteBlogPostAction(formData: FormData) {
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
  if (error) return { error: error.message }

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  if (existing?.slug) revalidatePath(`/blog/${existing.slug}`)
  redirect("/admin/blog")
}
