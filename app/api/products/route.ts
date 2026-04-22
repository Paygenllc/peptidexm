/**
 * Public storefront products JSON endpoint.
 *
 * Exists so **client-only** components (the header search dropdown,
 * the free-shipping upsell card) can consume live DB products without
 * being converted into server components. Server components should
 * import `getStorefrontProducts` from `@/lib/products-db` directly.
 *
 * No auth: the data is already publicly visible on the storefront grid.
 * RLS on the underlying `products`/`product_variants` tables already
 * allows anonymous SELECT, so this is not an additional exposure.
 *
 * Caching notes:
 *  - `dynamic = "force-dynamic"` keeps this route out of Next's
 *    static optimization. We want admin edits to show up instantly
 *    without waiting for a stale revalidate cycle.
 *  - On the client we layer SWR's in-memory dedupe/ revalidate-on-
 *    focus behaviour over this route (see header-search,
 *    free-shipping-upsell) so a page that pulls products in three
 *    places only makes one real fetch.
 */

import { NextResponse } from "next/server"
import { getStorefrontProducts } from "@/lib/products-db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const products = await getStorefrontProducts()
    return NextResponse.json({ products })
  } catch (err) {
    console.error("[api/products] unexpected error:", err)
    return NextResponse.json(
      { products: [], error: "products_unavailable" },
      { status: 500 },
    )
  }
}
