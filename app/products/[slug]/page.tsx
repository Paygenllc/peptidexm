import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductDetail } from "@/components/product-detail"
import { TrustStrip } from "@/components/trust-strip"
import {
  getAllProductSlugs,
  getProductBySlug,
  productSlug,
} from "@/lib/products-catalog"

export const dynamic = "force-static"
export const dynamicParams = false

/**
 * Pre-render every catalog product as a static page. We control the full
 * product list at build time via `lib/products-catalog.ts`, so there's no
 * reason to hit the network on request for this route.
 */
export function generateStaticParams() {
  return getAllProductSlugs().map((slug) => ({ slug }))
}

/**
 * Product-level metadata improves how individual vials render when shared
 * in search results, chat apps, and social previews — and gives email and
 * blog embeds a legitimate, indexable canonical URL to link to.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) {
    return {
      title: "Product not found — PeptideXM",
      robots: { index: false, follow: false },
    }
  }
  const title = `${product.name} — ${product.purity} | PeptideXM`
  const description = product.description
  const url = `/products/${productSlug(product)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: product.image ? [{ url: product.image, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: product.image ? [product.image] : undefined,
    },
  }
}

export default async function ProductPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) notFound()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-10">
          <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6">
            <Link
              href="/#products"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              All products
            </Link>
          </nav>

          {/* Two-column layout: product hero image on the left, details &
           * variant picker on the right. Collapses to a stacked single
           * column on mobile so the image never steals the fold. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary/40 border border-border/60">
              <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <ProductDetail product={product} />
          </div>
        </div>

        <TrustStrip />
      </main>
      <Footer />
    </div>
  )
}
