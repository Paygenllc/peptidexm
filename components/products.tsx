"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Plus, Check, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useCart } from "@/context/cart-context"
import {
  categories,
  products,
  productSlug,
  getUniqueStrengths,
  getFormsForStrength,
  type Product,
  type Variant,
} from "@/lib/products-catalog"

// Re-export for backward compatibility: older modules (checkout, cart, email
// builders, embed helpers) import `products` / `Variant` / `Product` from
// this file. Re-exporting keeps those imports working without a site-wide
// rewrite — the canonical source of truth is now `lib/products-catalog`.
export { products }
export type { Product, Variant }

// Selection shape stored per product: { strength, form }
type Selection = { strength: string; form: string }

export function Products() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [addedToCart, setAddedToCart] = useState<number[]>([])
  const { addItem } = useCart()

  // Sync from the header search bar (dispatched via CustomEvent on the window).
  // Also drop any active category filter so the user sees the full match set.
  useEffect(() => {
    function handleHeaderSearch(event: Event) {
      const detail = (event as CustomEvent<{ query: string }>).detail
      if (!detail) return
      setSearchQuery(detail.query)
      setSelectedCategory("All")
    }
    window.addEventListener("peptidexm:search", handleHeaderSearch)
    return () => window.removeEventListener("peptidexm:search", handleHeaderSearch)
  }, [])

  // Hydrate from ?q=... on first mount so a deep-link search works.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get("q")
    if (q) {
      setSearchQuery(q)
      setSelectedCategory("All")
    }
  }, [])

  // Initialize each product's selection: first strength, first form of that strength.
  const [selection, setSelection] = useState<Record<number, Selection>>(() => {
    const initial: Record<number, Selection> = {}
    for (const product of products) {
      const strengths = getUniqueStrengths(product.variants)
      const defaultStrength = strengths[0]
      const defaultForm = getFormsForStrength(product.variants, defaultStrength)[0]
      initial[product.id] = { strength: defaultStrength, form: defaultForm }
    }
    return initial
  })

  function setStrength(productId: number, strength: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const forms = getFormsForStrength(product.variants, strength)
    setSelection((prev) => ({
      ...prev,
      [productId]: {
        strength,
        // Preserve the previously selected form if it exists for this strength, else pick first.
        form: forms.includes(prev[productId]?.form) ? prev[productId].form : forms[0],
      },
    }))
  }

  function setForm(productId: number, form: string) {
    setSelection((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], form },
    }))
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory
        if (!matchesCategory) return false
        if (!normalizedQuery) return true
        return (
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.description.toLowerCase().includes(normalizedQuery) ||
          p.category.toLowerCase().includes(normalizedQuery)
        )
      }),
    [selectedCategory, normalizedQuery],
  )

  const handleAddToCart = (id: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const sel = selection[id]
    if (!sel) return

    const variantData = product.variants.find((v) => v.strength === sel.strength && v.form === sel.form)
    if (!variantData) return

    // Combine strength + form into a single human-readable label for the cart/order record.
    const variantLabel = `${sel.strength} — ${sel.form}`

    addItem({
      id: product.id,
      name: product.name,
      variant: variantLabel,
      price: variantData.price,
      quantity: 1,
      image: product.image,
    })

    setAddedToCart((prev) => [...prev, id])
    setTimeout(() => {
      setAddedToCart((prev) => prev.filter((i) => i !== id))
    }, 2000)
  }

  return (
    <section id="products" className="py-16 sm:py-24 lg:py-32 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            Our Collection
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-foreground text-balance">
            Premium Research Peptides
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            All compounds undergo rigorous third-party testing to ensure the highest quality for your research needs.
          </p>
        </div>

        {/* Search bar */}
        <div className="mx-auto max-w-xl mb-4 sm:mb-6">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search peptides by name, category, or description"
              aria-label="Search products"
              className="h-12 rounded-full pl-11 pr-11 bg-background shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6 sm:mb-10 -mx-4 sm:mx-0">
          <div className="flex sm:flex-wrap sm:justify-center gap-2 overflow-x-auto no-scrollbar px-4 sm:px-0 pb-1 snap-x snap-mandatory">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="rounded-full shrink-0 snap-start h-9"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {(normalizedQuery || selectedCategory !== "All") && (
          <p className="text-center text-sm text-muted-foreground mb-6 sm:mb-8" aria-live="polite">
            {filteredProducts.length === 0
              ? "No products found"
              : `Showing ${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`}
            {normalizedQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
          </p>
        )}

        {/* Empty state */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16 sm:py-24">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-xl sm:text-2xl text-foreground mb-2">No matches found</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Try a different search term or clear the filters to see all products.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
              }}
            >
              Reset filters
            </Button>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map((product) => {
            const strengths = getUniqueStrengths(product.variants)
            const sel = selection[product.id]
            const forms = sel ? getFormsForStrength(product.variants, sel.strength) : []
            const activeVariant = product.variants.find(
              (v) => v.strength === sel?.strength && v.form === sel?.form,
            )
            const price = activeVariant?.price ?? product.variants[0].price
            const showStrengthPicker = strengths.length > 1
            const showFormPicker = forms.length > 1
            const href = `/products/${productSlug(product)}`

            return (
              <Card
                key={product.id}
                className="group overflow-hidden border-border/50 hover:border-border hover:shadow-lg transition-all duration-300"
              >
                <CardContent className="p-0">
                  {/* Product Image Area — now links through to the detail page. */}
                  <Link
                    href={href}
                    aria-label={`View ${product.name} details`}
                    className="relative block aspect-square bg-secondary/50 overflow-hidden"
                  >
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.popular && (
                      <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Popular</Badge>
                    )}
                    {!product.inStock && (
                      <Badge variant="secondary" className="absolute top-3 right-3">
                        Out of Stock
                      </Badge>
                    )}
                  </Link>

                  {/* Product Details */}
                  <div className="p-3 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm sm:text-lg text-foreground group-hover:text-accent transition-colors truncate">
                          <Link href={href} className="hover:underline underline-offset-4 focus:outline-none focus-visible:underline">
                            {product.name}
                          </Link>
                        </h3>
                        <p className="text-[11px] sm:text-sm text-muted-foreground">{sel?.strength}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] sm:text-xs shrink-0 self-start">
                        {product.purity}
                      </Badge>
                    </div>

                    <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Strength picker */}
                    {showStrengthPicker && (
                      <div className="mb-2 sm:mb-3">
                        <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1 sm:mb-1.5">
                          <span className="hidden sm:inline">1. </span>Strength
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-1.5">
                          {strengths.map((s) => {
                            const active = s === sel?.strength
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setStrength(product.id, s)}
                                aria-pressed={active}
                                className={`h-7 sm:h-8 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-medium border transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-border hover:border-foreground/40"
                                }`}
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Form picker */}
                    {showFormPicker && (
                      <div className="mb-3 sm:mb-4">
                        <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1 sm:mb-1.5">
                          <span className="hidden sm:inline">{showStrengthPicker ? "2. " : ""}</span>Option
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-1.5">
                          {forms.map((f) => {
                            const active = f === sel?.form
                            return (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setForm(product.id, f)}
                                aria-pressed={active}
                                className={`h-7 sm:h-8 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-medium border transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-border hover:border-foreground/40"
                                }`}
                              >
                                {f}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <span className="font-serif text-lg sm:text-2xl text-foreground tabular-nums">
                        ${price.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        disabled={!product.inStock || addedToCart.includes(product.id)}
                        onClick={() => handleAddToCart(product.id)}
                        className="gap-1.5 h-9 px-3 sm:px-4 w-full sm:w-auto shrink-0"
                      >
                        {addedToCart.includes(product.id) ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            <span>Add</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            View All Products
          </Button>
        </div>
      </div>
    </section>
  )
}
