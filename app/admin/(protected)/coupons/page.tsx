import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { CouponsClient } from "./coupons-client"
import type { AdminCouponRow } from "@/app/admin/actions/coupons"

export const dynamic = "force-dynamic"

/**
 * Admin → Coupons.
 *
 * Server component that loads the most recent 200 coupons (matches
 * the abandoned-carts cap; same reasoning — plenty for the working
 * set, no pagination overhead in v1) along with each coupon's total
 * `amount_off` summed across its redemptions, then hands them off
 * to the interactive client.
 *
 * NUMERIC columns from Postgres come back as strings, so we coerce
 * `value`, `min_order_subtotal`, and the redemption sums here at
 * the boundary so the client never has to think about it.
 */
export default async function AdminCouponsPage() {
  await requireAdmin()
  const admin = createAdminClient()

  // Coupons themselves — one query, no joins. We aggregate
  // redemption totals separately because PostgREST doesn't expose
  // arbitrary aggregations through the .select() syntax, and a
  // small two-query approach is more transparent than an RPC.
  const { data: coupons, error } = await admin
    .from("coupons")
    .select(
      "id, code, type, value, max_uses, max_per_customer, min_order_subtotal, starts_at, expires_at, active, customer_email, source, notes, redemption_count, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.log("[v0] coupons list error:", error)
  }

  // Pull every redemption (only id + coupon_id + amount_off) for the
  // 200 coupons in one go. Even a heavily-used catalog would have at
  // most a few thousand redemption rows total — fine to sum in JS.
  const ids = (coupons ?? []).map((c) => c.id as string)
  const totalsByCoupon = new Map<string, number>()
  if (ids.length > 0) {
    const { data: redemptions, error: rErr } = await admin
      .from("coupon_redemptions")
      .select("coupon_id, amount_off")
      .in("coupon_id", ids)
    if (rErr) {
      console.log("[v0] coupon redemptions sum error:", rErr)
    }
    for (const r of redemptions ?? []) {
      const cid = r.coupon_id as string
      totalsByCoupon.set(
        cid,
        (totalsByCoupon.get(cid) ?? 0) + Number(r.amount_off),
      )
    }
  }

  const rows: AdminCouponRow[] = (coupons ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    type: c.type as "percent" | "fixed",
    value: Number(c.value),
    max_uses: (c.max_uses as number | null) ?? null,
    max_per_customer: (c.max_per_customer as number | null) ?? null,
    min_order_subtotal:
      c.min_order_subtotal == null ? null : Number(c.min_order_subtotal),
    starts_at: (c.starts_at as string | null) ?? null,
    expires_at: (c.expires_at as string | null) ?? null,
    active: c.active as boolean,
    customer_email: (c.customer_email as string | null) ?? null,
    source: (c.source as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
    redemption_count: Number(c.redemption_count ?? 0),
    total_amount_off: totalsByCoupon.get(c.id as string) ?? 0,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
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
      <CouponsClient initialCoupons={rows} />
    </div>
  )
}
