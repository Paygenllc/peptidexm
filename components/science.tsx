import { Button } from "@/components/ui/button"
import { ArrowRight, FileText } from "lucide-react"

const peptides = [
  {
    name: "XM-T (Dual Pathway)",
    mechanism: "Dual GIP/GLP-1 Receptor Agonist",
    description:
      "A once-weekly dual glucose-dependent insulinotropic polypeptide (GIP) and glucagon-like peptide-1 (GLP-1) receptor agonist. Research indicates significant effects on glucose metabolism and body composition.",
    keyPoints: ["Dual receptor targeting", "Extended half-life", "Metabolic research applications"],
  },
  {
    name: "XM-S (GLP-1 Pathway)",
    mechanism: "GLP-1 Receptor Agonist",
    description:
      "A glucagon-like peptide-1 receptor agonist with 94% structural similarity to native GLP-1. Widely studied for its effects on glycemic control and appetite regulation in research settings.",
    keyPoints: ["High receptor affinity", "Appetite regulation studies", "Cardiovascular research"],
  },
  {
    name: "Sermorelin",
    mechanism: "GHRH Analog",
    description:
      "A synthetic analog of growth hormone-releasing hormone (GHRH) consisting of the first 29 amino acids. Used in research exploring growth hormone secretion and pituitary function.",
    keyPoints: ["GHRH receptor binding", "Growth hormone research", "Pituitary function studies"],
  },
]

export function Science() {
  return (
    <section id="science" className="py-16 sm:py-24 lg:py-32 bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-background/60 mb-3 sm:mb-4">
            The Science
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-background text-balance">
            Understanding our peptides
          </h2>
          <p className="mt-4 text-base sm:text-lg text-background/70 max-w-2xl mx-auto text-pretty">
            Learn about the mechanisms and research applications of our most popular compounds.
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          {peptides.map((peptide, index) => (
            <div
              key={peptide.name}
              className="relative p-6 sm:p-8 lg:p-12 rounded-2xl bg-background/5 border border-background/10 hover:bg-background/10 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm font-medium text-background/50">
                      0{index + 1}
                    </span>
                    <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl text-background">
                      {peptide.name}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-accent mb-3 sm:mb-4 uppercase tracking-wide">
                    {peptide.mechanism}
                  </p>
                  <p className="text-sm sm:text-base text-background/70 leading-relaxed max-w-3xl">
                    {peptide.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4 sm:mt-6">
                    {peptide.keyPoints.map((point) => (
                      <span
                        key={point}
                        className="px-3 py-1 text-xs sm:text-sm rounded-full bg-background/10 text-background/80"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="gap-2 shrink-0 w-full lg:w-auto h-11"
                >
                  <FileText className="h-4 w-4" />
                  View Research
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 sm:mt-16">
          <Button
            variant="outline"
            size="lg"
            className="gap-2 border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background h-12 w-full sm:w-auto"
          >
            View All Research
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
