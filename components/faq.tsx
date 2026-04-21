import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "What purity levels do your peptides have?",
    answer: "All of our peptides maintain a minimum purity of 99% as verified by independent third-party HPLC and mass spectrometry testing. Each order includes a Certificate of Analysis (COA) documenting the exact purity percentage and testing methodology."
  },
  {
    question: "How should I store my peptides?",
    answer: "Lyophilized (freeze-dried) peptides should be stored at -20°C or below for long-term storage. Once reconstituted, peptides should be refrigerated at 2-8°C and used within 30 days. Avoid repeated freeze-thaw cycles as this can degrade the peptide."
  },
  {
    question: "Do you ship internationally?",
    answer: "Yes, we ship to most countries worldwide. International orders are shipped via temperature-controlled packaging with tracking. Please note that import regulations vary by country, and customers are responsible for ensuring compliance with local laws."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept PayPal, Zelle, USDT on the TRON network, and all major credit and debit cards (Visa, Mastercard, American Express, Discover). All transactions are processed through PCI-compliant providers — card details and PayPal credentials never touch our servers. We also offer discreet billing for your privacy."
  },
  {
    question: "Are your peptides for human use?",
    answer: "Our peptides are sold strictly for research and laboratory purposes only. They are not intended for human consumption, therapeutic use, or any clinical applications. By purchasing, you confirm that you understand and agree to these terms."
  },
  {
    question: "What is your return policy?",
    answer: "We offer a 30-day satisfaction guarantee on all unopened products. If you receive a damaged or incorrect item, please contact us at peptidexm@gmail.com within 48 hours for a full replacement. Opened products cannot be returned due to quality control requirements."
  },
  {
    question: "How long does shipping take?",
    answer: "Domestic orders are typically delivered within 1-3 business days. International shipping takes 5-10 business days depending on the destination. All orders placed before 2 PM EST are processed the same day."
  },
  {
    question: "Do you provide bulk or wholesale pricing?",
    answer: "Yes, we offer competitive pricing for bulk and wholesale orders. Contact our sales team at peptidexm@gmail.com for custom quotes on orders exceeding $500 or for establishing ongoing supply agreements for research institutions."
  },
]

export function FAQ() {
  return (
    <section id="faq" className="py-16 sm:py-24 lg:py-32 bg-secondary/30">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            FAQ
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-foreground text-balance">
            Common questions
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Find answers to frequently asked questions about our products and services.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border-b border-border/50"
            >
              <AccordionTrigger className="text-left font-medium text-base sm:text-lg text-foreground hover:text-accent py-5 sm:py-6 [&[data-state=open]>svg]:rotate-45 gap-3">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-muted-foreground pb-5 sm:pb-6 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
