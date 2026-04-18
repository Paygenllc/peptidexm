"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, X, ArrowRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { products, type Product } from "@/components/products"

const MAX_RESULTS = 6

type ScoredProduct = { product: Product; score: number; minPrice: number }

function minPrice(p: Product): number {
  return p.variants.reduce((m, v) => (v.price < m ? v.price : m), Number.POSITIVE_INFINITY)
}

function scoreProduct(p: Product, q: string): number {
  const name = p.name.toLowerCase()
  const cat = p.category.toLowerCase()
  const desc = p.description.toLowerCase()
  const strengths = p.variants.map((v) => v.strength.toLowerCase()).join(" ")

  // Exact name match beats everything
  if (name === q) return 100
  // Name starts with query
  if (name.startsWith(q)) return 80
  // Any word in name starts with query
  if (name.split(/[\s\-]+/).some((w) => w.startsWith(q))) return 70
  // Category exact / starts with
  if (cat === q) return 60
  if (cat.startsWith(q)) return 50
  // Strength match (e.g. "5mg")
  if (strengths.includes(q)) return 40
  // Substring in name
  if (name.includes(q)) return 30
  // Substring in description
  if (desc.includes(q)) return 15
  // Substring in category
  if (cat.includes(q)) return 10
  return 0
}

export function HeaderSearch({
  onSelectResult,
  autoFocus = false,
  className = "",
}: {
  onSelectResult?: () => void
  autoFocus?: boolean
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo<ScoredProduct[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    const scored: ScoredProduct[] = []
    for (const p of products) {
      const score = scoreProduct(p, q)
      if (score > 0) scored.push({ product: p, score, minPrice: minPrice(p) })
    }
    scored.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    return scored.slice(0, MAX_RESULTS)
  }, [query])

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0)
  }, [results.length])

  // Click outside closes the dropdown
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  // Auto focus if requested (mobile sheet)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const commitSearch = useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim()
      // Broadcast to the Products grid (same page) so it can sync its internal filter.
      window.dispatchEvent(new CustomEvent("peptidexm:search", { detail: { query: trimmed } }))
      setOpen(false)

      // Scroll the products grid into view without a page jump.
      const el = document.getElementById("products")
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      } else {
        // Grid not on this page — navigate home with a hash so the landing page opens scrolled.
        window.location.href = `/?q=${encodeURIComponent(trimmed)}#products`
      }
      onSelectResult?.()
    },
    [onSelectResult],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault()
        commitSearch(query)
      }
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const picked = results[activeIdx]?.product
      commitSearch(picked ? picked.name : query)
    }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search peptides..."
          aria-label="Search products"
          aria-expanded={showDropdown}
          aria-controls="header-search-results"
          role="combobox"
          className="h-10 rounded-full pl-9 pr-9 bg-secondary/60 border-border focus-visible:bg-background"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="header-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-border bg-popover shadow-xl ring-1 ring-black/5 overflow-hidden z-50"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches for <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            <ul className="max-h-[28rem] overflow-y-auto py-1">
              {results.map(({ product, minPrice: price }, idx) => {
                const active = idx === activeIdx
                return (
                  <li key={product.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => commitSearch(product.name)}
                      className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-secondary" : "hover:bg-secondary/60"
                      }`}
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-secondary">
                        <Image
                          src={product.image || "/placeholder.svg"}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">from</p>
                          <p className="text-sm font-medium text-foreground tabular-nums">${price.toFixed(0)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => commitSearch(query)}
            className="flex w-full items-center justify-between gap-2 border-t border-border bg-secondary/40 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <span className="truncate">
              See all results for <span className="text-accent">&ldquo;{query}&rdquo;</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  )
}
