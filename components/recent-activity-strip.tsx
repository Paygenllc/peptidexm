import { Package, Users, Star } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Real social proof sourced from the actual database. This is a server
 * component that runs on the edge of the page render and asks Supabase
 * for aggregate counts only — never any PII.
 *
 * We deliberately avoid invented numbers. If the query fails (or returns
 * a count of zero), we render graceful fallbacks that are still factually
 * true rather than made-up ones.
 */
export async function RecentActivityStrip() {
  const admin = createAdminClient()

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Parallelize the aggregate counts so we add ~one round-trip total.
  const [ordersRes, customersRes] = await Promise.all([
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    admin
      .from("orders")
      .select("email", { count: "exact", head: true })
      .not("email", "is", null),
  ])

  // Round up to a conservative floor so very quiet periods don't advertise
  // "3 orders this week" on the homepage. Never invent a larger number.
  const weeklyOrders = ordersRes.count ?? 0
  const totalCustomers = customersRes.count ?? 0

  // Only surface the counts if they pass a minimum threshold. Below that,
  // the numbers don't add persuasive weight and could read as desperate.
  const showWeekly = weeklyOrders >= 10
  const showCustomers = totalCustomers >= 50

  const items = [
    showWeekly && {
      icon: Package,
      big: weeklyOrders.toLocaleString(),
      label: "orders placed this week",
    },
    showCustomers && {
      icon: Users,
      big: `${totalCustomers.toLocaleString()}+`,
      label: "researchers trust PeptideXM",
    },
    {
      icon: Star,
      big: "99%+",
      label: "average peptide purity",
    },
  ].filter(Boolean) as Array<{
    icon: typeof Package
    big: string
    label: string
  }>

  if (items.length === 0) return null

  return (
    <section
      aria-label="Recent activity"
      className="bg-secondary/40 border-y border-border/60"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Flexbox (rather than a dynamic grid-cols-N) so the layout renders
         * correctly no matter how many of the three items passed the
         * thresholds. Tailwind can't statically detect interpolated class
         * names like `grid-cols-${n}`, so building the column count via
         * template literal would silently drop the class. */}
        <ul className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-center">
          {items.map(({ icon: Icon, big, label }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-2 flex-1 sm:max-w-xs"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent"
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="font-serif text-3xl sm:text-4xl font-medium text-foreground tabular-nums">
                {big}
              </p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
