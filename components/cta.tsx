import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { mailto } from "@/lib/contact"

export function CTA() {
  return (
    <section className="py-16 sm:py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-foreground px-6 py-12 sm:px-8 sm:py-16 lg:px-16 lg:py-24">
          {/* Background pattern */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] sm:bg-[size:32px_32px]"
          />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight text-background text-balance">
                Ready to start your research?
              </h2>
              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-background/70 text-pretty">
                Join thousands of researchers who trust PeptideXM for premium quality peptides.
                Get free shipping on orders over $150.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0">
              <Button size="lg" variant="secondary" className="gap-2 px-8 h-12 w-full sm:w-auto" asChild>
                <Link href="#products">
                  Shop Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8 h-12 w-full sm:w-auto border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
              >
                <a href={mailto("PeptideXM sales inquiry")}>Contact Sales</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
