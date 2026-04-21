import { FlaskConical, Truck, ShieldCheck, Lock } from "lucide-react"

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
      // Keep this readable on two lines at the narrow grid width — we list
      // the card brands by category ("credit & debit card") rather than
      // enumerating Visa/MC/Amex/Discover, which are surfaced visually on
      // the checkout payment selector via <CardBrandRow />.
      body: "Pay with Zelle, USDT on TRON, or credit & debit card.",
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
          {items.map(({ icon: Icon, title, body }) => (
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
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
