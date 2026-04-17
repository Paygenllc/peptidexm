import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-20">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-6">
            Research Grade Peptides
          </p>
          
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground max-w-5xl text-balance">
            Premium peptides for scientific excellence
          </h1>
          
          <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty">
            Laboratory-tested compounds with verified purity. 47+ premium peptides including 
            Tirzepatide, Semaglutide, Retatrutide, and more. Trusted by researchers worldwide.
          </p>
          
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="gap-2 px-8">
              View Products
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="px-8">
              Learn More
            </Button>
          </div>
          
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16">
            <div className="flex flex-col items-center">
              <span className="font-serif text-4xl md:text-5xl text-foreground">99%</span>
              <span className="mt-2 text-sm text-muted-foreground">Purity Tested</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-serif text-4xl md:text-5xl text-foreground">47+</span>
              <span className="mt-2 text-sm text-muted-foreground">Peptide Products</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-serif text-4xl md:text-5xl text-foreground">24h</span>
              <span className="mt-2 text-sm text-muted-foreground">Fast Shipping</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-serif text-4xl md:text-5xl text-foreground">100%</span>
              <span className="mt-2 text-sm text-muted-foreground">Satisfaction</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
