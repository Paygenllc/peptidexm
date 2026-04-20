import Link from "next/link"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

/**
 * Server-rendered pagination control for admin list pages.
 *
 * All state lives in the URL (`?page=N`) so the back button, refresh, and
 * deep-linking just work. We deliberately do not memoize page links with
 * Link's prefetch default — for paginated tables most users only click
 * Next/Prev, and eager prefetching every page burst would be wasteful.
 *
 * `params` is the *other* search params that should survive page changes
 * (filters, search text, etc). We strip `page` defensively in case it's
 * passed in by a caller that destructured all searchParams.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  compact = false,
  pageKey = "page",
}: {
  basePath: string
  params: Record<string, string | undefined>
  page: number
  pageSize: number
  total: number
  compact?: boolean
  pageKey?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)

  // Don't render at all when there's nothing to paginate — keeps the
  // underlying card looking clean on small data sets.
  if (total <= pageSize) return null

  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(total, current * pageSize)

  const buildHref = (target: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (k === pageKey) continue
      if (v === undefined || v === null || v === "") continue
      qs.set(k, v)
    }
    if (target > 1) qs.set(pageKey, String(target))
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  const prev = current > 1 ? buildHref(current - 1) : null
  const next = current < totalPages ? buildHref(current + 1) : null
  const first = current > 2 ? buildHref(1) : null
  const last = current < totalPages - 1 ? buildHref(totalPages) : null

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4"
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {compact ? (
          <>Page {current} of {totalPages}</>
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{from.toLocaleString()}</span>–
            <span className="font-medium text-foreground">{to.toLocaleString()}</span> of{" "}
            <span className="font-medium text-foreground">{total.toLocaleString()}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-1">
        <PageButton href={first} ariaLabel="First page" disabled={!first}>
          <ChevronsLeft className="w-4 h-4" />
        </PageButton>
        <PageButton href={prev} ariaLabel="Previous page" disabled={!prev}>
          <ChevronLeft className="w-4 h-4" />
        </PageButton>
        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          {current} / {totalPages}
        </span>
        <PageButton href={next} ariaLabel="Next page" disabled={!next}>
          <ChevronRight className="w-4 h-4" />
        </PageButton>
        <PageButton href={last} ariaLabel="Last page" disabled={!last}>
          <ChevronsRight className="w-4 h-4" />
        </PageButton>
      </div>
    </nav>
  )
}

function PageButton({
  href,
  ariaLabel,
  disabled,
  children,
}: {
  href: string | null
  ariaLabel: string
  disabled?: boolean
  children: React.ReactNode
}) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors"
  if (disabled || !href) {
    return (
      <span
        aria-label={ariaLabel}
        aria-disabled="true"
        className={`${base} opacity-40 pointer-events-none`}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`${base} hover:bg-accent hover:text-foreground`}
    >
      {children}
    </Link>
  )
}

/**
 * Parse a `page` value out of a searchParams record, clamping to >= 1.
 * Keeps every list page's boilerplate identical.
 */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return n
}
