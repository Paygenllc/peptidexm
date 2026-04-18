import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { BlogPostEditor } from "../blog-post-editor"

export const dynamic = "force-dynamic"

export default async function BlogPostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single()
  if (!post) notFound()

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to blog
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{post.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {post.status}
            {post.published_at &&
              ` · published ${new Date(post.published_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}`}
          </p>
        </div>
        {post.status === "published" && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View public page
          </Link>
        )}
      </div>

      <BlogPostEditor
        mode="edit"
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content_markdown: post.content_markdown,
          cover_image_url: post.cover_image_url,
          tags: post.tags || [],
          status: post.status,
        }}
      />
    </div>
  )
}
