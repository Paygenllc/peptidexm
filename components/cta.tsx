import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-16 lg:px-16 lg:py-24">
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />
          
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight text-background text-balance">
                Ready to start your research?
              </h2>
              <p className="mt-4 text-lg text-background/70">
                Join thousands of researchers who trust PeptideXM for premium quality peptides. 
                Get free shipping on orders over $150.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" variant="secondary" className="gap-2 px-8">
                Shop Now
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 border-background/20 text-background hover:bg-background/10 hover:text-background"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
