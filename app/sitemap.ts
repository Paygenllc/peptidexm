import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.peptidexm.com"

export const revalidate = 3600 // Rebuild sitemap hourly so new posts show up promptly.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/#products`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/#science`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/#faq`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/blog`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/admin/login`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/admin/signup`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ]

  // Pull published blog posts from Supabase. Protected by a try/catch so build
  // can still succeed if Supabase is momentarily unreachable.
  try {
    const supabase = await createClient()
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, published_at, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(500)

    const blogEntries: MetadataRoute.Sitemap = (posts || []).map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : (post.published_at ? new Date(post.published_at) : lastModified),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))

    return [...staticEntries, ...blogEntries]
  } catch (err) {
    console.error("[v0] sitemap blog fetch failed", err)
    return staticEntries
  }
}
