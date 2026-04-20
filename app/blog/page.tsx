import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Pagination, parsePage } from "@/components/admin/pagination"

export const metadata: Metadata = {
  title: "Journal — PeptideXM",
  description: "Research notes, protocols, and quality updates from the PeptideXM lab team.",
}

// Always fetch fresh on request so new posts appear immediately after publish.
export const dynamic = "force-dynamic"

const PAGE_SIZE = 10

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageRaw } = await searchParams
  const page = parsePage(pageRaw)
  const supabase = await createClient()
  const from = (page - 1) * PAGE_SIZE
  const { data: posts, count } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, tags, published_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  const total = count ?? 0

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
      <Header />

      <section className="pt-28 sm:pt-32 pb-12 sm:pb-16 bg-secondary/30 border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Journal
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-balance">
            Research notes & protocols
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl text-pretty">
            Occasional writing from our lab team on peptide science, handling, and the
            practical side of high-quality research chemistry.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {posts && posts.length > 0 ? (
            <>
            <ul className="space-y-10">
              {posts.map((post) => (
                <li key={post.slug} className="group">
                  <Link href={`/blog/${post.slug}`} className="block">
                    <article className="grid gap-6 sm:grid-cols-[1fr_240px]">
                      <div className="order-2 sm:order-1">
                        {post.tags && post.tags.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {post.tags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-balance group-hover:text-accent transition-colors">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="mt-2 text-muted-foreground leading-relaxed text-pretty">
                            {post.excerpt}
                          </p>
                        )}
                        {post.published_at && (
                          <p className="mt-3 text-xs text-muted-foreground/80 uppercase tracking-wide">
                            {new Date(post.published_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      {post.cover_image_url ? (
                        <div className="order-1 sm:order-2 relative aspect-[4/3] sm:aspect-[3/2] overflow-hidden rounded-lg bg-secondary">
                          <Image
                            src={post.cover_image_url || "/placeholder.svg"}
                            alt=""
                            fill
                            sizes="(min-width: 640px) 240px, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      ) : null}
                    </article>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              basePath="/blog"
              params={{}}
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
            />
            </>
          ) : (
            <div className="py-24 text-center">
              <p className="font-serif text-2xl text-foreground mb-2">Nothing published yet.</p>
              <p className="text-muted-foreground">Check back soon.</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
