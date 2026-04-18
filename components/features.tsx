import { Shield, Microscope, Truck, Award, HeartPulse, Lock } from "lucide-react"

const features = [
  {
    icon: Microscope,
    title: "Lab Verified",
    description:
      "Every batch undergoes comprehensive third-party HPLC and mass spectrometry testing for purity verification.",
  },
  {
    icon: Shield,
    title: "Quality Assured",
    description:
      "Manufactured in GMP-compliant facilities with strict quality control protocols at every step.",
  },
  {
    icon: Truck,
    title: "Fast Shipping",
    description:
      "Same-day processing with temperature-controlled packaging. Discreet delivery within 24-48 hours.",
  },
  {
    icon: Award,
    title: "99%+ Purity",
    description:
      "We guarantee minimum 99% purity on all peptides with certificates of analysis included.",
  },
  {
    icon: HeartPulse,
    title: "Research Support",
    description:
      "Access to detailed documentation, research protocols, and dedicated customer support.",
  },
  {
    icon: Lock,
    title: "Secure Orders",
    description:
      "Encrypted transactions, discrete billing, and complete privacy for all your orders.",
  },
]

export function Features() {
  return (
    <section id="about" className="py-16 sm:py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            Why Choose Us
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-foreground text-balance">
            Committed to excellence
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            We set the standard for research peptide quality, transparency, and customer service.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative p-6 sm:p-8 rounded-2xl bg-card border border-border/50 hover:border-border hover:shadow-lg transition-all duration-300"
            >
              <div className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-secondary mb-4 sm:mb-6">
                <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" aria-hidden="true" />
              </div>
              <h3 className="font-medium text-lg sm:text-xl text-foreground mb-2 sm:mb-3">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
