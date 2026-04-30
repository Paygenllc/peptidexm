import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { CouponsClient, type CouponView } from "./coupons-client"

export const dynamic = "force-dynamic"

/**
 * Admin → Coupons.
 *
 * Server component that loads the most recent 200 coupons (matches
 * the abandoned-carts page cap; same reasoning — plenty for the
 * working set, no pagination overhead in v1) along with their
 * redemption counts, then hands the data off to the interactive
 * client. Money is normalized to numbers here at the boundary so
 * the client never has to coerce Postgres NUMERIC strings.
 */
export default async function AdminCouponsPage() {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("coupons")
    .select(
      "id, code, type, value, max_uses, max_per_customer, min_order_subtotal, starts_at, expires_at, active, customer_email, source, notes, redemption_count, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.log("[v0] coupons list error:", error)
  }

  const coupons: CouponView[] = (data ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    type: c.type as "percent" | "fixed",
    value: Number(c.value),
    maxUses: c.max_uses as number | null,
    maxPerCustomer: c.max_per_customer as number | null,
    minOrderSubtotal:
      c.min_order_subtotal == null ? null : Number(c.min_order_subtotal),
    startsAt: c.starts_at as string | null,
    expiresAt: c.expires_at as string | null,
    active: c.active as boolean,
    customerEmail: c.customer_email as string | null,
    source: c.source as string | null,
    notes: c.notes as string | null,
    redemptionCount: Number(c.redemption_count ?? 0),
    createdAt: c.created_at as string,
    updatedAt: c.updated_at as string,
  }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-foreground">
          Coupons
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Create and manage discount codes. Codes are case-insensitive and
          re-usable across rails (Zelle, card, crypto, PayPal).
        </p>
      </div>
      <CouponsClient initialCoupons={coupons} />
    </div>
  )
}
