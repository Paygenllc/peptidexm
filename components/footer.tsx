import Link from "next/link"
import { Mail } from "lucide-react"
import { NewsletterForm } from "@/components/newsletter-form"
import { CONTACT_EMAIL, mailto } from "@/lib/contact"
import {
  PaypalLogo,
  ZelleLogo,
  TetherLogo,
  VisaLogo,
  MastercardLogo,
  AmexLogo,
  DiscoverLogo,
} from "@/components/payment-logos"

const navigation = {
  products: [
    { name: "Tirzepatide", href: "/products/tirzepatide" },
    { name: "Semaglutide", href: "/products/semaglutide" },
    { name: "Retatrutide", href: "/products/retatrutide" },
    { name: "BPC-157", href: "/products/bpc-157" },
    { name: "All 47+ Products", href: "/#products" },
  ],
  company: [
    { name: "About Us", href: "/#about" },
    { name: "Science", href: "/#science" },
    { name: "Journal", href: "/blog" },
    { name: "Quality", href: "/quality" },
  ],
  support: [
    { name: "FAQ", href: "/#faq" },
    { name: "Shipping", href: "/shipping" },
    { name: "Returns", href: "/returns" },
    { name: "Contact", href: "/contact" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Research Disclaimer", href: "/research-disclaimer" },
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

        {/* Accepted payment methods — sits above the copyright row so the
            list of brands is the first thing customers see when they scan
            the footer. Logos have their own opaque fills so they render
            cleanly on the dark footer background. */}
        <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-background/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <p className="text-xs font-medium uppercase tracking-wider text-background/50">
              We accept
            </p>
            <div
              aria-label="Accepted payment methods: PayPal, Zelle, USDT on the TRON network, Visa, Mastercard, American Express, and Discover"
              className="flex items-center gap-2 flex-wrap"
            >
              {/* PayPal leads the row to mirror the checkout page order;
                  all marks have their own opaque fills so they stay
                  legible against the dark footer background. */}
              <PaypalLogo className="h-6 w-auto" />
              <ZelleLogo className="h-6 w-auto" />
              <TetherLogo className="h-6 w-auto" />
              <VisaLogo className="h-6 w-auto" />
              <MastercardLogo className="h-6 w-auto" />
              <AmexLogo className="h-6 w-auto" />
              <DiscoverLogo className="h-6 w-auto" />
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-background/10 safe-pb">
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
