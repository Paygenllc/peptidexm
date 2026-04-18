import Link from "next/link"
import { Mail } from "lucide-react"
import { NewsletterForm } from "@/components/newsletter-form"
import { CONTACT_EMAIL, mailto } from "@/lib/contact"

const navigation = {
  products: [
    { name: "Tirzepatide", href: "#" },
    { name: "Semaglutide", href: "#" },
    { name: "Retatrutide", href: "#" },
    { name: "BPC-157", href: "#" },
    { name: "All 47+ Products", href: "#products" },
  ],
  company: [
    { name: "About Us", href: "/#about" },
    { name: "Science", href: "/#science" },
    { name: "Journal", href: "/blog" },
    { name: "Quality", href: "#" },
  ],
  support: [
    { name: "FAQ", href: "#faq" },
    { name: "Shipping", href: "#" },
    { name: "Returns", href: "#" },
    { name: "Contact", href: mailto("PeptideXM inquiry") },
  ],
  legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
    { name: "Research Disclaimer", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer id="contact" className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 lg:px-8 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-8">
          {/* Left side - Brand and Newsletter */}
          <div className="max-w-md">
            <Link href="/" className="inline-block" aria-label="PeptideXM home">
              <span className="font-serif text-2xl sm:text-3xl tracking-tight text-background">
                Peptide<span className="text-accent">XM</span>
              </span>
            </Link>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-background/60 leading-relaxed">
              Premium research peptides with verified purity. Trusted by researchers
              worldwide for quality and reliability.
            </p>

            <div className="mt-6 sm:mt-8">
              <p className="text-sm font-medium text-background mb-3 sm:mb-4">
                Subscribe to our newsletter
              </p>
              <NewsletterForm tone="dark" source="footer" />
              <p className="mt-3 text-xs text-background/40">
                Get updates on new products and research. No spam, unsubscribe anytime.
              </p>
            </div>

            <div className="mt-8 sm:mt-10">
              <p className="text-sm font-medium text-background mb-2">Get in touch</p>
              <a
                href={mailto("PeptideXM inquiry")}
                className="inline-flex items-center gap-2 text-sm sm:text-base text-background/80 hover:text-background transition-colors break-all"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{CONTACT_EMAIL}</span>
              </a>
            </div>
          </div>

          {/* Right side - Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <h3 className="text-sm font-medium text-background">Products</h3>
              <ul className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3">
                {navigation.products.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm text-background/60 hover:text-background transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-background">Company</h3>
              <ul className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3">
                {navigation.company.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm text-background/60 hover:text-background transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-background">Support</h3>
              <ul className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3">
                {navigation.support.map((item) => {
                  const isMailto = item.href.startsWith("mailto:")
                  const className = "text-sm text-background/60 hover:text-background transition-colors"
                  return (
                    <li key={item.name}>
                      {isMailto ? (
                        <a href={item.href} className={className}>
                          {item.name}
                        </a>
                      ) : (
                        <Link href={item.href} className={className}>
                          {item.name}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-background">Legal</h3>
              <ul className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3">
                {navigation.legal.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm text-background/60 hover:text-background transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-background/10 safe-pb">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-background/40">
              &copy; {new Date().getFullYear()} PeptideXM. All rights reserved.
            </p>
            <p className="text-xs text-background/40 max-w-md">
              For research purposes only. Not for human consumption.
              By purchasing, you agree to our terms of service.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
