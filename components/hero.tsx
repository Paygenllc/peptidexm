import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-background pt-20">
      {/* Background pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px] sm:bg-[size:64px_64px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 lg:px-8 lg:py-32 w-full">
        <div className="flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4 sm:mb-6">
            Research Grade Peptides
          </p>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground max-w-5xl text-balance leading-[1.05]">
            Premium peptides for scientific excellence
          </h1>

          <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty leading-relaxed">
            Laboratory-tested compounds with verified purity. 47+ premium peptides including
            Tirzepatide, Semaglutide, Retatrutide, and more. Trusted by researchers worldwide.
          </p>

          <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            <Button size="lg" className="gap-2 px-8 h-12 w-full sm:w-auto" asChild>
              <Link href="#products">
                View Products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="px-8 h-12 w-full sm:w-auto" asChild>
              <Link href="#science">Learn More</Link>
            </Button>
          </div>

          <div className="mt-14 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-16 w-full max-w-3xl">
            <div className="flex flex-col items-center">
              <span className="font-serif text-3xl sm:text-4xl md:text-5xl text-foreground">99%</span>
              <span className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">Purity Tested</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-serif text-3xl sm:text-4xl md:text-5xl text-foreground">47+</span>
              <span className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">Peptide Products</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-serif text-3xl sm:text-4xl md:text-5xl text-foreground">24h</span>
              <span className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">Fast Shipping</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-serif text-3xl sm:text-4xl md:text-5xl text-foreground">100%</span>
              <span className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">Satisfaction</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
