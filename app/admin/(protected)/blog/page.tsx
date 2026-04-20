import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Plus, ExternalLink } from "lucide-react"
import { Pagination, parsePage } from "@/components/admin/pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageRaw } = await searchParams
  const page = parsePage(pageRaw)

  const supabase = await createClient()
  const from = (page - 1) * PAGE_SIZE
  const [pageRes, totalsRes] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, status, tags, published_at, created_at, updated_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    // Second call is tiny — just `status` — so summary counts stay accurate
    // across the whole catalog, not just the current page.
    supabase.from("blog_posts").select("status"),
  ])

  const posts = pageRes.data ?? []
  const total = pageRes.count ?? 0
  const allStatuses = totalsRes.data ?? []
  const published = allStatuses.filter((p) => p.status === "published").length
  const drafts = allStatuses.filter((p) => p.status === "draft").length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" /> Blog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {published} published · {drafts} draft{drafts === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/blog" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" />
              View public blog
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/blog/new" className="gap-2">
              <Plus className="w-4 h-4" /> New post
            </Link>
          </Button>
        </div>
      </div>

      {posts.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-foreground font-medium">No blog posts yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Share product updates, research, and customer stories with your audience.
          </p>
          <Button asChild className="mt-5 gap-2">
            <Link href="/admin/blog/new">
              <Plus className="w-4 h-4" /> Write your first post
            </Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 border-b border-border text-left">
                <tr>
                  <th className="p-3 font-medium text-muted-foreground">Title</th>
                  <th className="p-3 font-medium text-muted-foreground">Tags</th>
                  <th className="p-3 font-medium text-muted-foreground">Status</th>
                  <th className="p-3 font-medium text-muted-foreground">Updated</th>
                  <th className="p-3 font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="p-3">
                      <Link href={`/admin/blog/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.title}
                      </Link>
                      {p.excerpt && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[420px]">
                          {p.excerpt}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(p.tags || []).slice(0, 3).map((t: string) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={p.status === "published" ? "default" : "outline"} className="capitalize">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(p.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 text-right">
                      {p.status === "published" && (
                        <Link
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" /> View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination
        basePath="/admin/blog"
        params={{}}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  )
}
