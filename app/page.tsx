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
import { DiscountPopup } from "@/components/discount-popup"

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
      <Products />
      <Features />
      <Science />
      <FAQ />
      <CTA />
      <Footer />
      <DiscountPopup />
    </main>
  )
}
