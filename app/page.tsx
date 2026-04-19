import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Products } from "@/components/products"
import { Features } from "@/components/features"
import { Science } from "@/components/science"
import { FAQ } from "@/components/faq"
import { CTA } from "@/components/cta"
import { Footer } from "@/components/footer"
import { AuthHashErrorHandler } from "@/components/auth-hash-error-handler"
import { TrustStrip } from "@/components/trust-strip"
import { RecentActivityStrip } from "@/components/recent-activity-strip"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string; code?: string }>
}) {
  const params = await searchParams

  // If Supabase redirected back to "/" with error params, forward to the error page
  if (params.error || params.error_description) {
    const message = params.error_description || params.error || "Authentication failed"
    redirect(`/auth/error?message=${encodeURIComponent(message)}`)
  }

  // If Supabase redirected back to "/" with a valid ?code=, forward it to the callback
  if (params.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=/admin/bootstrap`)
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
      <AuthHashErrorHandler />
      <Header />
      <Hero />
      {/* Trust strip: factual purchase-reassurance signals. Sits between the
       * hero and the product grid so it's seen by every visitor before they
       * shop — and again via the product cards that repeat "ships same day". */}
      <TrustStrip />
      <Products />
      {/* RecentActivityStrip is a server component that queries the orders
       * table for real aggregates. It gracefully renders nothing below the
       * minimum threshold so we never show "3 orders this week". */}
      <RecentActivityStrip />
      <Features />
      <Science />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  )
}
