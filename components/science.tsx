import { Button } from "@/components/ui/button"
import { ArrowRight, FileText } from "lucide-react"

const peptides = [
  {
    name: "Tirzepatide",
    mechanism: "Dual GIP/GLP-1 Receptor Agonist",
    description: "A once-weekly dual glucose-dependent insulinotropic polypeptide (GIP) and glucagon-like peptide-1 (GLP-1) receptor agonist. Research indicates significant effects on glucose metabolism and body composition.",
    keyPoints: ["Dual receptor targeting", "Extended half-life", "Metabolic research applications"],
  },
  {
    name: "Semaglutide",
    mechanism: "GLP-1 Receptor Agonist",
    description: "A glucagon-like peptide-1 receptor agonist with 94% structural similarity to native GLP-1. Widely studied for its effects on glycemic control and appetite regulation in research settings.",
    keyPoints: ["High receptor affinity", "Appetite regulation studies", "Cardiovascular research"],
  },
  {
    name: "Sermorelin",
    mechanism: "GHRH Analog",
    description: "A synthetic analog of growth hormone-releasing hormone (GHRH) consisting of the first 29 amino acids. Used in research exploring growth hormone secretion and pituitary function.",
    keyPoints: ["GHRH receptor binding", "Growth hormone research", "Pituitary function studies"],
  },
]

export function Science() {
  return (
    <section id="science" className="py-24 lg:py-32 bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium uppercase tracking-widest text-background/60 mb-4">
            The Science
          </p>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight text-background">
            Understanding our peptides
          </h2>
          <p className="mt-4 text-lg text-background/70 max-w-2xl mx-auto">
            Learn about the mechanisms and research applications of our most popular compounds.
          </p>
        </div>

        <div className="space-y-8">
          {peptides.map((peptide, index) => (
            <div
              key={peptide.name}
              className="relative p-8 lg:p-12 rounded-2xl bg-background/5 border border-background/10 hover:bg-background/10 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-sm font-medium text-background/50">0{index + 1}</span>
                    <h3 className="font-serif text-2xl lg:text-3xl text-background">
                      {peptide.name}
                    </h3>
                  </div>
                  <p className="text-sm font-medium text-accent mb-4">
                    {peptide.mechanism}
                  </p>
                  <p className="text-background/70 leading-relaxed max-w-3xl">
                    {peptide.description}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-6">
                    {peptide.keyPoints.map((point) => (
                      <span
                        key={point}
                        className="px-3 py-1 text-sm rounded-full bg-background/10 text-background/80"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
                <Button variant="secondary" className="gap-2 shrink-0">
                  <FileText className="h-4 w-4" />
                  View Research
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Button 
            variant="outline" 
            size="lg" 
            className="gap-2 border-background/20 text-background hover:bg-background/10 hover:text-background"
          >
            View All Research
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
