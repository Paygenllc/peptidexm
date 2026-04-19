"use client"

import { useEffect, useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Package, Loader2, Search } from "lucide-react"
import { createClient as createBrowserSupabase } from "@/lib/supabase/client"

type ProductRow = {
  slug: string
  name: string
  category: string | null
  image_url: string | null
}

/**
 * Popover that lets an admin pick a product to embed into a blog post or
 * broadcast. On select, calls `onInsert(slug)` — the parent is responsible
 * for inserting the resulting `[[product:slug]]` token at the cursor in its
 * own editor (TipTap, textarea, etc).
 *
 * Products are loaded lazily the first time the popover is opened, so the
 * editor's initial render stays snappy. The list reads `public.products`
 * directly with the signed-in admin's Supabase client — `active = true` rows
 * are publicly readable, so no extra endpoint is needed.
 */
export function ProductPicker({
  onInsert,
  trigger,
}: {
  onInsert: (slug: string) => void
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open || loaded || loading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const supabase = createBrowserSupabase()
        const { data, error: fetchErr } = await supabase
          .from("products")
          .select("slug, name, category, image_url")
          .eq("active", true)
          .order("name", { ascending: true })
        if (cancelled) return
        if (fetchErr) {
          setError(fetchErr.message)
        } else {
          setProducts(data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load products")
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, loaded, loading])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    )
  }, [query, products])

  function handleSelect(slug: string) {
    onInsert(slug)
    setOpen(false)
    setQuery("")
  }

  const defaultTrigger = (
    <button
      type="button"
      className="h-8 px-2 rounded-md inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground text-xs font-medium"
      title="Insert product"
      aria-label="Insert product"
    >
      <Package className="w-4 h-4" />
      <span>Product</span>
    </button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
      <PopoverContent className="p-0 w-[340px] max-w-[90vw]" align="start">
        <div className="p-2 border-b border-border bg-secondary/40">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading products…
            </div>
          )}
          {error && (
            <div className="px-4 py-6 text-xs text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-4 py-6 text-xs text-muted-foreground text-center">
              {products.length === 0
                ? "No active products."
                : "No products match your search."}
            </div>
          )}
          <ul>
            {filtered.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => handleSelect(p.slug)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
                >
                  <div className="relative w-10 h-10 rounded bg-secondary shrink-0 overflow-hidden">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url || "/placeholder.svg"}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="absolute inset-0 m-auto w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.category ? `${p.category} · ` : ""}
                      {p.slug}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground">
          Inserts <code className="px-1 py-0.5 rounded bg-secondary font-mono">[[product:slug]]</code> at the cursor.
        </div>
      </PopoverContent>
    </Popover>
  )
}
