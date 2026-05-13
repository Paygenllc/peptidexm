import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Pagination, parsePage } from "@/components/admin/pagination"
import { BlogFilters } from "./blog-filters"

export const metadata: Metadata = {
  title: "Journal — PeptideXM",
  description: "Research notes, protocols, and quality updates from the PeptideXM lab team.",
}

// Always fetch fresh on request so new posts appear immediately after publish
// and filter changes are never stuck behind a CDN cache.
export const dynamic = "force-dynamic"

const PAGE_SIZE = 10

/**
 * Escape user input before it's interpolated into a Postgres `ilike` pattern.
 *
 * `%` and `_` are wildcard chars in LIKE, so a search for "100%" would match
 * everything containing "100". Backslashes also need escaping because Postgres
 * recognises them as the default LIKE escape character. We swap any present
 * before adding wildcards around the term.
 *
 * Commas additionally have to be stripped because we're embedding the value
 * inside a postgrest `.or()` expression where commas separate filter clauses
 * — a stray comma in user input would split the filter and 400 the request.
 */
function escapeIlikeTerm(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ")
    .replace(/\(/g, " ")
    .replace(/\)/g, " ")
    .trim()
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; tag?: string }>
}) {
  const { page: pageRaw, q: qRaw, tag: tagRaw } = await searchParams
  const page = parsePage(pageRaw)
  const q = (qRaw ?? "").trim().slice(0, 80)
  const tag = (tagRaw ?? "").trim().slice(0, 40)

  const supabase = await createClient()

  // 1) Pull all distinct tags across published posts so the chip bar can
  //    render the full universe of filter options, not just tags that
  //    happen to be on the current page. Tags are denormalised onto each
  //    post row as a text[], so a single column read + flatten in JS is
  //    cheaper than a join, and there are typically <100 posts to scan.
  //    We cap defensively at 1000 to bound worst-case memory.
  const { data: tagRows } = await supabase
    .from("blog_posts")
    .select("tags")
    .eq("status", "published")
    .limit(1000)

  const allTags = Array.from(
    new Set(
      (tagRows ?? [])
        .flatMap((r) => (Array.isArray(r.tags) ? (r.tags as string[]) : []))
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))

  // 2) Build the filtered, paginated query for the visible list.
  const from = (page - 1) * PAGE_SIZE
  let query = supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, tags, published_at", { count: "exact" })
    .eq("status", "published")

  if (tag) {
    // Postgres array contains — exact match on a tag value. The chip bar
    // only emits tags that already exist in `allTags`, so we don't bother
    // case-normalising here.
    query = query.contains("tags", [tag])
  }

  if (q) {
    // Free-text matching across title, excerpt, and full markdown body.
    // `or()` builds a SQL OR across the listed filters. We could move to
    // tsvector + websearch_to_tsquery for relevance ranking later, but
    // ilike is plenty for the current article volume and gives the user
    // "this word appears somewhere" behaviour they expect.
    const safe = escapeIlikeTerm(q)
    if (safe.length > 0) {
      const pattern = `%${safe}%`
      query = query.or(
        `title.ilike.${pattern},excerpt.ilike.${pattern},content_markdown.ilike.${pattern}`,
      )
    }
  }

  const { data: posts, count } = await query
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const total = count ?? 0
  const hasFilters = q.length > 0 || tag.length > 0

  // Pagination needs to preserve the active filters so Next/Prev stay
  // inside the user's narrowed result set.
  const paginationParams: Record<string, string> = {}
  if (q) paginationParams.q = q
  if (tag) paginationParams.tag = tag

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
      <Header />

      {/* Hero — pure intro copy. The filter controls live in their own
          band below so they get full visual weight as a tool rather than
          competing with the headline. */}
      <section className="pt-28 sm:pt-32 pb-10 sm:pb-14 bg-secondary/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Journal</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-balance">
            Research notes & protocols
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl text-pretty">
            Occasional writing from our lab team on peptide science, handling, and the practical
            side of high-quality research chemistry.
          </p>
        </div>
      </section>

      {/* Sticky filter bar — search + category chips immediately below
          the hero, persistent as the user scrolls the post list. */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <BlogFilters allTags={allTags} />
      </div>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {hasFilters && (
            <div
              className="mb-6 flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  {total.toLocaleString()}
                </span>{" "}
                {total === 1 ? "result" : "results"}
              </span>
              {q && (
                <span>
                  for &ldquo;<span className="text-foreground">{q}</span>&rdquo;
                </span>
              )}
              {tag && (
                <span>
                  tagged <span className="text-foreground">{tag}</span>
                </span>
              )}
            </div>
          )}

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
                              {post.tags.slice(0, 3).map((t: string) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
                                >
                                  {t}
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
                params={paginationParams}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
              />
            </>
          ) : (
            <div className="py-24 text-center">
              {hasFilters ? (
                <>
                  <p className="font-serif text-2xl text-foreground mb-2">No matching articles.</p>
                  <p className="text-muted-foreground">
                    Try a broader search, or{" "}
                    <Link href="/blog" className="text-foreground underline underline-offset-4">
                      clear the filters
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="font-serif text-2xl text-foreground mb-2">Nothing published yet.</p>
                  <p className="text-muted-foreground">Check back soon.</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
