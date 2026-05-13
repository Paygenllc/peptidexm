"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, X } from "lucide-react"

/**
 * Header-mounted controls for /blog: free-text search + clickable tag chips.
 *
 * All state lives in the URL (`?q=...&tag=...`) so deep links, the back
 * button, and SSR pagination all just work. The search box is the only
 * piece that needs JS — chip clicks are plain links that re-render the
 * server page with new search params.
 *
 * We debounce typing by ~300ms before calling `router.replace`, which is
 * the standard "feels live but doesn't thrash the network" interval.
 * `startTransition` keeps the input responsive while the new server
 * render is in flight (no spinner needed — the URL change is instant
 * and React keeps the old list visible until the new one is ready).
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

  const [, startTransition] = useTransition()
  const debounceRef = useRef<number | null>(null)

  // Build a fresh URL by merging in a single param change. We always drop
  // `page` because filtering should reset the user to the first page —
  // staying on page 8 when the result set has 4 pages is broken UX.
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
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
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
          className="w-full h-11 rounded-full border border-border bg-background pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({ tag: null })}
            scroll={false}
            aria-pressed={activeTag === ""}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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
                // Re-clicking an active tag clears it — common "toggle" expectation.
                href={buildHref({ tag: active ? null : tag })}
                scroll={false}
                aria-pressed={active}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground/80 hover:bg-secondary/70"
                }`}
              >
                {tag}
              </Link>
            )
          })}

          {hasActiveFilters && (
            <Link
              href="/blog"
              scroll={false}
              className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
