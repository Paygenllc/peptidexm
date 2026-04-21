import type { ReactNode } from "react"
import { FlaskConical, Truck, ShieldCheck, Lock } from "lucide-react"
import {
  PaypalLogo,
  ZelleLogo,
  TetherLogo,
  VisaLogo,
  MastercardLogo,
  AmexLogo,
  DiscoverLogo,
} from "@/components/payment-logos"

/**
 * Site-wide trust indicators rendered as a compact strip. Designed to live
 * just under the hero on the homepage and above the footer on deeper pages.
 *
 * Every claim here is something we actually enforce elsewhere in the codebase:
 *  - third-party testing — see `purity` on every catalog entry
 *  - free shipping over $500 — see `lib/shipping.ts`
 *  - same-day dispatch — our order fulfillment SLA (static copy)
 *  - secure crypto + Zelle + card checkout — HMAC-verified NOWPayments IPN
 *    for crypto, PCI-compliant tokenised card processing, and no card
 *    data ever persisted on our servers
 *
 * Keep this strictly factual. No invented order counts, no fabricated
 * review numbers. Real social proof lives in `RecentActivityStrip` and is
 * sourced from the orders table.
 */
export function TrustStrip() {
  // The "Secure checkout" cell embeds a compact marks row so customers
  // can recognize accepted payment methods at a glance. Logos below are
  // sized to stay level with the body text, not to compete with it.
  const logoClass = "h-4 w-auto"
  const securePaymentMarks: ReactNode = (
    <div
      aria-label="Accepted payment methods: PayPal, Zelle, USDT on the TRON network, Visa, Mastercard, American Express, and Discover"
      className="mt-2 flex items-center gap-1.5 flex-wrap"
    >
      {/* PayPal leads the row to match the order shoppers see on the
          checkout page — default rail first, everything else after. */}
      <PaypalLogo className={logoClass} />
      <ZelleLogo className={logoClass} />
      <TetherLogo className={logoClass} />
      <VisaLogo className={logoClass} />
      <MastercardLogo className={logoClass} />
      <AmexLogo className={logoClass} />
      <DiscoverLogo className={logoClass} />
    </div>
  )

  const items = [
    {
      icon: FlaskConical,
      title: "Third-party tested",
      body: "Every batch ships with a current Certificate of Analysis.",
    },
    {
      icon: Truck,
      title: "Free US shipping over $500",
      body: "Same-day dispatch on orders placed before 2pm ET.",
    },
    {
      icon: Lock,
      title: "Secure checkout",
      body: "Pay with PayPal, Zelle, USDT on TRON, or credit & debit card.",
      extra: securePaymentMarks,
    },
    {
      icon: ShieldCheck,
      title: "Purity guarantee",
      body: "Not satisfied? We'll replace or refund within 30 days.",
    },
  ] as const

  return (
    <section
      aria-label="Why shop with PeptideXM"
      className="border-y border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {items.map((item) => {
            const { icon: Icon, title, body } = item
            const extra = "extra" in item ? item.extra : null
            return (
              <li key={title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                  {extra}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
