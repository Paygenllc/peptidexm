import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { Pagination, parsePage } from "@/components/admin/pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 25

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q ?? ""
  const category = params.category ?? "all"
  const page = parsePage(params.page)

  const supabase = await createClient()
  let query = supabase
    .from("products")
    .select(
      "id, slug, name, category, active, featured, image_url, product_variants(id, variant_name, price)",
      { count: "exact" },
    )
    .order("sort_order", { ascending: true })

  if (q) query = query.ilike("name", `%${q}%`)
  if (category !== "all") query = query.eq("category", category)

  const from = (page - 1) * PAGE_SIZE
  const { data: products, count } = await query.range(from, from + PAGE_SIZE - 1)
  const total = count ?? 0

  const { data: allCategories } = await supabase.from("products").select("category")
  const categories = Array.from(
    new Set((allCategories ?? []).map((p) => p.category).filter(Boolean) as string[]),
  ).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <form className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search products..." className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={q ? `?q=${q}` : "?"}
              className={`px-3 py-1.5 rounded-md text-sm ${
                category === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={{ query: { ...(q ? { q } : {}), category: c } }}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  category === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Variants</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Price Range</th>
              </tr>
            </thead>
            <tbody>
              {products?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              )}
              {products?.map((p) => {
                const prices = (p.product_variants ?? []).map((v: any) => Number(v.price))
                const min = prices.length ? Math.min(...prices) : 0
                const max = prices.length ? Math.max(...prices) : 0
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <Link href={`/admin/products/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">/{p.slug}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.category}</td>
                    <td className="p-3 text-muted-foreground">{p.product_variants?.length ?? 0}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant={p.active ? "default" : "outline"}>{p.active ? "Active" : "Inactive"}</Badge>
                        {p.featured && <Badge variant="secondary">Featured</Badge>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold text-foreground">
                      {prices.length > 0
                        ? min === max
                          ? `$${min.toFixed(2)}`
                          : `$${min.toFixed(2)} - $${max.toFixed(2)}`
                        : "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        basePath="/admin/products"
        params={{ q, category: category === "all" ? undefined : category }}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  )
}
