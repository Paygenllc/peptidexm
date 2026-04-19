import "server-only"
import { createClient } from "@/lib/supabase/server"

/**
 * Product embed tokens.
 *
 * Admins can insert a `[[product:some-slug]]` token anywhere in a blog post
 * (TipTap) or an email broadcast (markdown). On render, these helpers:
 *
 *   1. Find every unique slug referenced in the content.
 *   2. Fetch the matching active rows from public.products in a single query.
 *   3. Replace the tokens with a rendered product card — inline-styled HTML for
 *      email (since email clients strip stylesheets) or class-based HTML for
 *      the blog (which runs through DOMPurify + our Tailwind prose styles).
 *
 * Tokens inside a wrapping `<p>` (the most common shape — both our minimal
 * markdown renderer and TipTap wrap standalone lines in paragraphs) are
 * detected and the whole paragraph is replaced with the card, avoiding an
 * awkward extra paragraph around the block-level card.
 */

const EMBED_TOKEN_RE = /\[\[product:([a-z0-9][a-z0-9-]*)\]\]/gi

export function extractProductSlugs(content: string): string[] {
  if (!content) return []
  const slugs = new Set<string>()
  for (const m of content.matchAll(EMBED_TOKEN_RE)) {
    slugs.add(m[1].toLowerCase())
  }
  return Array.from(slugs)
}

export type EmbedProduct = {
  slug: string
  name: string
  category: string | null
  image_url: string | null
  purity: string | null
  description: string | null
}

export async function fetchProductsBySlugs(slugs: string[]): Promise<Map<string, EmbedProduct>> {
  const map = new Map<string, EmbedProduct>()
  if (slugs.length === 0) return map
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("slug, name, category, image_url, purity, description")
    .in("slug", slugs)
    .eq("active", true)
  for (const p of (data ?? []) as EmbedProduct[]) {
    map.set(p.slug, p)
  }
  return map
}

const BRAND = "#8b5e34"
const MUTED = "#6b7280"
const BORDER = "#ecd8c0"

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim()
  if (clean.length <= n) return clean
  return clean.slice(0, n - 1).trimEnd() + "…"
}

/**
 * Normalize an asset/page URL to an absolute form using `siteUrl` as the base.
 * Email clients (Gmail, Apple Mail, Outlook) do not resolve relative `src`
 * or `href` values — they require absolute URLs — and absolute URLs also
 * harden blog content against being consumed in contexts outside the site.
 */
function absoluteUrl(path: string | null | undefined, siteUrl: string): string {
  if (!path) return `${siteUrl}/placeholder.svg`
  // Already absolute (http, https, data, blob, mailto, ...).
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path
  // Protocol-relative URLs.
  if (path.startsWith("//")) return `https:${path}`
  // Site-absolute paths such as "/products/foo.jpg".
  if (path.startsWith("/")) return `${siteUrl}${path}`
  // Bare file / relative path: treat as site-root-relative.
  return `${siteUrl}/${path}`
}

/**
 * Build the public destination for a product. The storefront does not have a
 * dedicated `/products/[slug]` route today — every product is a card inside
 * the `#products` section on the homepage. Linking there (with a `p` query
 * param for future deep-linking) keeps the CTA functional while we wait on a
 * real detail page. When a detail page ships, update this one function.
 */
function productHref(slug: string, siteUrl: string): string {
  return `${siteUrl}/?p=${encodeURIComponent(slug)}#products`
}

/** Email-safe card: single table with inline styles; no CSS classes. */
function cardForEmail(p: EmbedProduct, siteUrl: string): string {
  const url = productHref(p.slug, siteUrl)
  // Email clients strip relative URLs; always emit an absolute https:// src.
  const img = absoluteUrl(p.image_url, siteUrl)
  const category = p.category ? escapeHtml(p.category) : ""
  const snippet = p.description ? escapeHtml(truncate(p.description, 120)) : ""
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#fdf6ee;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
  <tr>
    <td width="128" style="padding:0;vertical-align:top;">
      <a href="${url}" style="display:block;width:128px;height:128px;"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" width="128" height="128" style="display:block;width:128px;height:128px;object-fit:cover;border:0;outline:none;text-decoration:none;" /></a>
    </td>
    <td style="padding:16px 20px;vertical-align:top;">
      ${category ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND};margin-bottom:4px;">${category}</div>` : ""}
      <div style="font-family:Georgia,serif;font-size:17px;font-weight:500;color:#111827;margin-bottom:6px;line-height:1.3;">
        <a href="${url}" style="color:#111827;text-decoration:none;">${escapeHtml(p.name)}</a>
      </div>
      ${snippet ? `<div style="font-size:13px;color:${MUTED};line-height:1.5;margin-bottom:12px;">${snippet}</div>` : ""}
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:13px;font-weight:500;padding:8px 14px;border-radius:6px;">View product →</a>
    </td>
  </tr>
</table>`
}

/** Blog card: uses `not-prose` to escape the prose styles, then Tailwind classes. */
function cardForBlog(p: EmbedProduct): string {
  // Site-relative is fine for browser rendering; a leading slash keeps the
  // link valid from any route in the app.
  const url = `/?p=${encodeURIComponent(p.slug)}#products`
  const img = p.image_url || "/placeholder.svg"
  return `
<a href="${url}" class="not-prose block my-6 no-underline overflow-hidden rounded-lg border border-border bg-secondary/40 transition-colors hover:bg-secondary">
  <div class="flex flex-col sm:flex-row">
    <div class="relative w-full sm:w-40 aspect-[4/3] sm:aspect-square shrink-0 bg-background overflow-hidden">
      <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" class="absolute inset-0 w-full h-full object-cover" />
    </div>
    <div class="flex-1 p-4 sm:p-5">
      ${p.category ? `<div class="text-xs uppercase tracking-wider text-primary mb-1.5">${escapeHtml(p.category)}</div>` : ""}
      <div class="font-serif text-lg font-medium text-foreground mb-1">${escapeHtml(p.name)}</div>
      ${p.description ? `<div class="text-sm text-muted-foreground line-clamp-2">${escapeHtml(truncate(p.description, 150))}</div>` : ""}
      <div class="mt-3 inline-flex items-center text-sm text-primary font-medium">View product →</div>
    </div>
  </div>
</a>`
}

/**
 * Replace every product token in `html` with a rendered card. Tokens that
 * reference slugs not in the product map (archived, renamed, typos) are
 * silently removed so broken references don't surface to readers.
 */
export function expandProductEmbeds(
  html: string,
  products: Map<string, EmbedProduct>,
  variant: "blog" | "email",
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://peptidexm.com",
): string {
  if (!html) return html

  const renderFor = (slug: string): string => {
    const p = products.get(slug.toLowerCase())
    if (!p) return ""
    return variant === "email" ? cardForEmail(p, siteUrl) : cardForBlog(p)
  }

  // Pass 1: a paragraph whose sole contents are the token -> replace the
  // whole paragraph with the block-level card.
  const wrapped = /<p[^>]*>\s*\[\[product:([a-z0-9][a-z0-9-]*)\]\]\s*<\/p>/gi
  let out = html.replace(wrapped, (_m, slug: string) => renderFor(slug))

  // Pass 2: any remaining tokens embedded elsewhere (inline or bare HTML).
  out = out.replace(EMBED_TOKEN_RE, (_m, slug: string) => renderFor(slug))

  return out
}

/**
 * Convenience: fetch + expand in one call. Use in server components /
 * server actions where you start with raw content and want the final HTML.
 */
export async function renderContentWithProducts(
  html: string,
  variant: "blog" | "email",
  siteUrl?: string,
): Promise<string> {
  const slugs = extractProductSlugs(html)
  if (slugs.length === 0) return html
  const products = await fetchProductsBySlugs(slugs)
  return expandProductEmbeds(html, products, variant, siteUrl)
}
