import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ContactForm } from "./contact-form"
import { CONTACT_EMAIL } from "@/lib/contact"
import { Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Contact · PeptideXM",
  description:
    "Questions about an order, products, or research? Reach the PeptideXM team — we respond to every message.",
}

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Contact
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight text-balance text-foreground">
            We read every message.
          </h1>
          <p className="text-muted-foreground text-pretty leading-relaxed max-w-2xl">
            Whether it&apos;s a question about an order, a product, or anything
            else, send us a note. Replies come from a real human, usually within
            one business day. You can also email us directly at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>

        <ContactForm />
      </main>
      <Footer />
    </>
  )
}
