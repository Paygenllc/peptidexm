import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Products } from "@/components/products"
import { Features } from "@/components/features"
import { Science } from "@/components/science"
import { FAQ } from "@/components/faq"
import { CTA } from "@/components/cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Products />
      <Features />
      <Science />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  )
}
