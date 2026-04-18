import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProseMarkdown } from "@/components/prose-markdown"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (!post) return { title: "Post not found — PeptideXM" }

  return {
    title: `${post.title} — PeptideXM Journal`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, content_markdown, cover_image_url, tags, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (!post) notFound()

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
      <Header />

      <article className="pt-28 sm:pt-32 pb-16 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All posts
          </Link>

          {post.tags && post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="font-serif text-4xl sm:text-5xl font-medium tracking-tight text-balance">
            {post.title}
          </h1>

          {post.published_at && (
            <p className="mt-4 text-sm text-muted-foreground">
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </p>
          )}

          {post.cover_image_url ? (
            <div className="mt-8 relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-secondary">
              <Image
                src={post.cover_image_url || "/placeholder.svg"}
                alt=""
                fill
                sizes="(min-width: 1024px) 768px, 100vw"
                priority
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="mt-10">
            <ProseMarkdown>{post.content_markdown}</ProseMarkdown>
          </div>
        </div>
      </article>

      <Footer />
    </main>
  )
}
