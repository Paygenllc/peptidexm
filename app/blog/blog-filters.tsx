"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, X, SlidersHorizontal } from "lucide-react"

/**
 * Dedicated filter bar shown directly below the journal hero.
 *
 * Layout: a full-bleed band with its own background and border so the
 * search/category controls read as a distinct, prominent piece of UI
 * rather than a footer of the hero. The band sticks to the top of the
 * viewport once scrolled past, keeping search & tags reachable as the
 * reader moves down the post list.
 *
 * All filter state lives in the URL (`?q=...&tag=...`) so deep links,
 * the back button, and SSR pagination all just work. The search input
 * is the only piece that needs JS — chip clicks are plain links that
 * re-render the server page with new params.
 *
 * Typing is debounced ~300ms before `router.replace` to avoid thrashing
 * the network; `startTransition` keeps the input responsive while the
 * new server render is in flight (no spinner needed — React keeps the
 * old list visible until the new one is ready).
 */
export function BlogFilters({
  allTags,
}: {
  /** Sorted, deduped tag list across all published posts. */
  allTags: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const activeTag = searchParams.get("tag") ?? ""

  // Local mirror of the input so typing stays snappy regardless of how
  // fast the server responds. We re-sync from the URL if it changes from
  // outside this component (e.g. clicking "Clear" or a tag chip).
  const [text, setText] = useState(q)
  useEffect(() => {
    setText(q)
  }, [q])

  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<number | null>(null)

  // Build a fresh URL by merging in a single param change. We always drop
  // `page` because filtering should reset to the first page — staying on
  // page 8 when the result set has 4 pages is broken UX.
  const buildHref = useMemo(
    () =>
      (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams.toString())
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === "") next.delete(k)
          else next.set(k, v)
        }
        next.delete("page")
        const qs = next.toString()
        return qs ? `/blog?${qs}` : "/blog"
      },
    [searchParams],
  )

  const pushQuery = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      startTransition(() => {
        router.replace(buildHref({ q: value.trim() || null }), { scroll: false })
      })
    }, 300)
  }

  const hasActiveFilters = q.length > 0 || activeTag.length > 0

  return (
    // Sticky band: pinned to the top of the viewport once scrolled past.
    // `top-16` clears the fixed site header (h-16). z-index sits below
    // any header dropdowns but above the post list.
    <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground"
            />
            <input
              type="search"
              inputMode="search"
              value={text}
              onChange={(e) => {
                const v = e.target.value
                setText(v)
                pushQuery(v)
              }}
              placeholder="Search articles, protocols, peptide names…"
              aria-label="Search journal"
              className="w-full h-12 rounded-full border border-border bg-background pl-11 pr-11 text-[15px] placeholder:text-muted-foreground/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
            />
            {text.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setText("")
                  startTransition(() => {
                    router.replace(buildHref({ q: null }), { scroll: false })
                  })
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setText("")
                startTransition(() => {
                  router.replace("/blog", { scroll: false })
                })
              }}
              className="hidden sm:inline-flex items-center gap-1.5 h-12 px-4 rounded-full border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Category chips row — horizontally scrollable on small screens
            so a long tag list never wraps into an oversized stack that
            pushes the post list down. The gradient fade hints there's
            more content to scroll to on the right. */}
        {allTags.length > 0 && (
          <div className="relative mt-4 -mx-4 sm:mx-0">
            <div
              role="group"
              aria-label="Filter by category"
              className="flex items-center gap-2 overflow-x-auto px-4 sm:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <SlidersHorizontal
                aria-hidden="true"
                className="hidden sm:inline-block w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mr-1"
              />
              <Link
                href={buildHref({ tag: null })}
                scroll={false}
                aria-pressed={activeTag === ""}
                className={`shrink-0 inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                  activeTag === ""
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground/80 hover:bg-secondary/70"
                }`}
              >
                All
              </Link>
              {allTags.map((tag) => {
                const active = activeTag === tag
                return (
                  <Link
                    key={tag}
                    // Re-clicking an active tag clears it — common toggle expectation.
                    href={buildHref({ tag: active ? null : tag })}
                    scroll={false}
                    aria-pressed={active}
                    className={`shrink-0 inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-secondary text-foreground/80 hover:bg-secondary/70"
                    }`}
                  >
                    {tag}
                  </Link>
                )
              })}
            </div>
            {/* Right-edge fade so the overflow is discoverable on mobile.
                Hidden on sm+ where the bar typically fits without scroll. */}
            <div
              aria-hidden="true"
              className="sm:hidden pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
            />
          </div>
        )}

        {/* Subtle visual cue that a search is in flight. Keeps the layout
            stable (no spinner shift) and disappears the moment the next
            server render commits. */}
        {isPending && (
          <div
            aria-hidden="true"
            className="mt-3 h-px w-full bg-accent/60 animate-pulse"
          />
        )}
      </div>
    </div>
  )
}
