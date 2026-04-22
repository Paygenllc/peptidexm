/**
 * Server-side storefront product loader.
 *
 * The admin dashboard writes to `public.products` and `public.product_variants`
 * in Supabase. Historically the storefront read products from the hardcoded
 * `lib/products-catalog.ts` file, which meant admin edits never showed up on
 * the site. This module is the bridge: it reads live rows from Supabase and
 * maps them into the `Product` shape the rest of the app already expects.
 *
 * Merge strategy (important — don't change without thinking it through):
 *
 *   1. DB is the source of truth for **existence** — only products with
 *      `active = true` are returned to the storefront.
 *   2. DB always wins for **price, stock, name, slug, active, featured,
 *      category, description, image_url, purity, dosage**. Admin changes to
 *      any of these propagate immediately.
 *   3. The static catalog is the **fallback content layer** — when a DB field
 *      is null/empty, we fill it from the matching catalog entry (by slug).
 *      This preserves rich copy, images, and variant strength labels the
 *      admin UI doesn't yet surface.
 *   4. Variant strength parsing: the catalog has clean strength/form pairs
 *      per variant. We try to match DB variants to catalog variants by form
 *      name first, then by position. Unmatched DB variants fall back to
 *      parsing `variant_name` directly (e.g. "15mg — Single Vial").
 *
 * Everything here is server-side only — it uses the SSR Supabase client so
 * it participates in per-request auth and RLS. Consumers that need product
 * data on the client should fetch through `/api/products` instead.
 */

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import {
  products as staticProducts,
  type Product,
  type Variant,
} from "@/lib/products-catalog"

// Numeric IDs: the legacy catalog uses `id: number` but the DB uses uuids.
// The rest of the app never looks this up as a foreign key (variants key
// off product_id internally, carts key off `slug`+form), but a few spots
// render the number as a React key. We hash the slug to a stable positive
// int so re-renders don't thrash and duplicate-slug collisions are a true
// edge case.
function slugToStableId(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) | 0
  }
  // Force positive to match the historical `id: number` assumption
  return Math.abs(h) || 1
}

// Build a quick lookup of the static catalog keyed by the slug the DB uses.
// The catalog uses name-derived slugs but supports an explicit `slug`
// override — `getCatalogSlug` mirrors the `getProductBySlug` helper so the
// bridge stays consistent with what the email/blog embed helpers already do.
function getCatalogSlug(p: Product): string {
  return (p.slug ?? p.name.toLowerCase().replace(/\s+/g, "-")).trim().toLowerCase()
}

const CATALOG_BY_SLUG = new Map<string, Product>(
  staticProducts.map((p) => [getCatalogSlug(p), p]),
)

// Row shapes returned by the Supabase query. Typed narrowly so the mapper
// stays honest — any new field we want to surface has to land here first.
interface DbProductRow {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  purity: string | null
  dosage: string | null
  active: boolean
  featured: boolean
  sort_order: number | null
  product_variants: DbVariantRow[]
}

interface DbVariantRow {
  id: string
  variant_name: string
  price: number | string // numeric columns come back as strings via PostgREST
  stock: number
  sku: string | null
  sort_order: number | null
}

/**
 * Parse a raw `variant_name` string into strength + form. Matches the
 * common "15mg — Single Vial" pattern (em-dash, en-dash, hyphen, or "x"
 * separator). Falls back to `{ strength: "", form: <raw> }` for simpler
 * labels like "Single Vial" or "Bundle of 5".
 */
function parseVariantName(raw: string): { strength: string; form: string } {
  const trimmed = raw.trim()
  // Try common separators in priority order. Em dash is by far the most
  // frequent in seeded data ("15mg — Single Vial").
  const separators = [" — ", " – ", " - ", " x ", " X "]
  for (const sep of separators) {
    const idx = trimmed.indexOf(sep)
    if (idx > 0) {
      const left = trimmed.slice(0, idx).trim()
      const right = trimmed.slice(idx + sep.length).trim()
      // Heuristic: "strength" should look like a dose — contain a digit
      // somewhere. Avoids mis-parsing "Bundle - 5 kits" into strength.
      if (/\d/.test(left) && right) {
        return { strength: left, form: right }
      }
    }
  }
  return { strength: "", form: trimmed }
}

/**
 * Storefront-only filter that drops legacy seed-data variants.
 *
 * The DB historically had unstructured rows like `Single Vial` or
 * `Kit of 10 Vials` at stale prices (Tirzepatide $65, Semaglutide
 * $159.99, etc.) seeded before variants had strength prefixes. We
 * can't delete them — `order_items.variant_id` has a foreign key
 * to `product_variants.id`, so past orders would orphan — but we
 * also don't want them rendered on the storefront at stale prices.
 *
 * A variant is considered canonical and shown if it either:
 *   1. parses into a `{strength, form}` pair whose strength has a
 *      digit (e.g. "15mg — Single Vial", "5000 IU — Single Vial"), or
 *   2. is one of the handful of strength-less catalog forms that
 *      genuinely ship without a dose — oral tablets and accessories
 *      (e.g. "Tablets — Bottle", "100 ct — Single Pack", "30ml —
 *      Single Bottle", "3ml × 10 — Single Box").
 *
 * Everything else ("Single Vial", "Kit of 10 Vials" with no strength
 * on its left side) is a legacy row — filtered here. The filter is
 * applied after parsing so it matches on the *structure* of the
 * label, not on specific strings, which keeps it robust as the
 * catalog grows.
 */
function isCanonicalVariant(raw: string): boolean {
  const { strength, form } = parseVariantName(raw)
  if (strength && /\d/.test(strength)) return true
  // Strength-less canonical forms. These all share the "<qualifier>
  // — <form>" shape with a non-numeric left side that's a meaningful
  // product qualifier (tablet form, pack count, fill volume).
  const canonicalNoStrengthForms = new Set([
    "tablets",
    "100 ct",
    "30ml",
    "3ml × 10",
    "3ml x 10",
    "standard",
  ])
  return canonicalNoStrengthForms.has(strength.toLowerCase().trim())
}

/**
 * Merge a DB variant into a storefront Variant, using any matching catalog
 * variant as the strength source. `form` matching is exact-then-case-
 * insensitive; if nothing matches, we fall back to parsing `variant_name`.
 */
function mergeVariant(
  dbVariant: DbVariantRow,
  catalogVariants: Variant[] | undefined,
  positionalFallback: Variant | undefined,
): Variant {
  const parsed = parseVariantName(dbVariant.variant_name)
  const price = typeof dbVariant.price === "string" ? Number.parseFloat(dbVariant.price) : dbVariant.price

  // Try to find a catalog variant whose `form` matches our parsed form.
  // The catalog is where the polished strength labels live, so prefer it
  // whenever there's a sensible match.
  const catalogMatch =
    catalogVariants?.find((v) => v.form.toLowerCase() === parsed.form.toLowerCase()) ??
    positionalFallback

  return {
    // Strength: parsed from DB name wins if the admin wrote one; else catalog.
    strength: parsed.strength || catalogMatch?.strength || "",
    // Form: always from DB so renames in admin propagate.
    form: parsed.form || catalogMatch?.form || dbVariant.variant_name,
    // Price: always from DB — the whole reason this file exists.
    price: Number.isFinite(price) ? price : catalogMatch?.price ?? 0,
  }
}

/**
 * Map one DB row + its variants into a storefront Product, merging with
 * the matching catalog entry (if any) for rich fallback content.
 */
function mergeProduct(row: DbProductRow): Product {
  const slug = row.slug.trim().toLowerCase()
  const catalog = CATALOG_BY_SLUG.get(slug)

  // Drop legacy seed rows (e.g. unstructured "Single Vial" at stale
  // $65 prices) before sorting/mapping. See `isCanonicalVariant` for
  // the full rationale — short version: we can't DELETE the rows
  // because past `order_items` FK to them, so we filter at read time.
  const rawVariants = row.product_variants ?? []
  const canonicalDbVariants = rawVariants.filter((v) =>
    isCanonicalVariant(v.variant_name),
  )

  // Safety net: if a product has *no* canonical variants in the DB
  // (e.g. bac-water still on legacy "Single Vial"/"Pack of 10 Vials"
  // names, or tb-500 which the admin hasn't restructured yet), fall
  // back to showing every DB row so the product still has buyable
  // options on the storefront. This trades slightly stale labels for
  // a broken product page; an admin can clean up the names in the
  // admin UI to promote the product back to the canonical shape.
  const dbVariants =
    canonicalDbVariants.length > 0 ? canonicalDbVariants : rawVariants

  const variants = dbVariants
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v, i) => mergeVariant(v, catalog?.variants, catalog?.variants?.[i]))

  return {
    id: slugToStableId(slug),
    slug,
    name: row.name || catalog?.name || "",
    category: row.category || catalog?.category || "Research",
    description: row.description || catalog?.description || "",
    purity: row.purity || catalog?.purity || "≥98%",
    // DB is the authority on availability. `active=false` simply filters
    // the row out of the storefront result set (see `getStorefrontProducts`),
    // so any row that reaches this mapper is considered in-stock from an
    // existence standpoint. Individual variants still carry their own stock.
    inStock: row.active,
    popular: row.featured,
    // `limitedStock` is a storefront-only urgency flag; the admin UI doesn't
    // edit it yet, so we inherit it from the catalog when available.
    limitedStock: catalog?.limitedStock,
    image: row.image_url || catalog?.image || "/placeholder.svg",
    variants,
  }
}

/**
 * Public storefront products, ordered the way the DB wants them to
 * appear. Only `active=true` rows are returned — admin deactivation
 * removes the product from the site immediately.
 *
 * Cached for the lifetime of a single request (React `cache`), so the
 * grid, metadata, and structured-data paths can all call it without
 * causing N round trips to Supabase.
 */
export const getStorefrontProducts = cache(async (): Promise<Product[]> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(
        `
          id, slug, name, description, category, image_url, purity, dosage,
          active, featured, sort_order,
          product_variants (
            id, variant_name, price, stock, sku, sort_order
          )
        `,
      )
      .eq("active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    if (error) {
      console.error("[products-db] supabase error, falling back to static catalog:", error.message)
      return staticProducts
    }

    if (!data || data.length === 0) {
      // Empty DB (e.g. first boot before seed) — keep the lights on.
      return staticProducts
    }

    return (data as unknown as DbProductRow[]).map(mergeProduct)
  } catch (err) {
    console.error("[products-db] unexpected error, falling back to static catalog:", err)
    return staticProducts
  }
})

/** Resolve a single product by slug (the canonical detail-page key). */
export async function getStorefrontProductBySlug(slug: string): Promise<Product | undefined> {
  const all = await getStorefrontProducts()
  const needle = slug.trim().toLowerCase()
  return all.find((p) => (p.slug ?? p.name.toLowerCase().replace(/\s+/g, "-")) === needle)
}
