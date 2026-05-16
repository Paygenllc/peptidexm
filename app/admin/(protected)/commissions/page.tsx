import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { CommissionsClient } from "./commissions-client"
import type { AffiliateRow, RedemptionRow } from "./types"

export const dynamic = "force-dynamic"

/**
 * Admin → Commissions.
 *
 * Read-only report that turns affiliate coupon redemptions into an
 * earnings ledger. Commission is computed live from
 * `coupon_redemptions × coupons.commission_rate_percent` — no
 * payouts schema yet, so figures are always "as of right now."
 *
 * Commissionable base = `subtotal_at_redemption − amount_off`, i.e.
 * what the customer actually paid for goods after the discount.
 * This is the same number affiliate programs typically pay on
 * (ignores shipping & tax, never counts the discount we ate).
 *
 * Date range comes in via `from`/`to` query strings (YYYY-MM-DD).
 * Defaults to the last 30 days when neither is provided.
 */
export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const admin = createAdminClient()

  // --- Date window resolution ------------------------------------------------
  // We accept partial input (just `from`, just `to`) and fill the
  // other side with sensible defaults so admins can deep-link a
  // single bookmark and still get a useful view.
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fromIso = parseDateOr(sp.from, defaultFrom)
  // The "to" boundary is end-of-day so a date like 2026-01-31
  // includes orders placed at 23:59 on that day.
  const toIso = parseDateOr(sp.to, now, /* endOfDay */ true)

  // --- Fetch affiliate coupons ---------------------------------------------
  // Affiliate coupons are the only rows that can earn commission, so
  // we filter early and keep payload small. `commission_rate_percent`
  // is optional even on affiliate coupons — we treat NULL as 0 so the
  // report never lies about owed money.
  const { data: coupons, error: couponsErr } = await admin
    .from("coupons")
    .select(
      "id, code, affiliate_name, affiliate_email, commission_rate_percent, type, value, source",
    )
    .or("source.eq.affiliate,affiliate_name.not.is.null")

  if (couponsErr) {
    console.log("[v0] commissions: coupons fetch error:", couponsErr)
  }

  const couponIds = (coupons ?? []).map((c) => c.id as string)
  const couponById = new Map(
    (coupons ?? []).map((c) => [c.id as string, c] as const),
  )

  // --- Fetch redemptions in the window --------------------------------------
  // Joined to orders for status + order number. We only count
  // redemptions whose underlying order is *paid* — pending /
  // refunded / cancelled don't earn commission. The status filter
  // lives in JS rather than the query so the admin can flip the
  // toggle without re-running the database round-trip.
  const { data: redemptions, error: redErr } =
    couponIds.length === 0
      ? { data: [], error: null }
      : await admin
          .from("coupon_redemptions")
          .select(
            "id, coupon_id, order_id, amount_off, subtotal_at_redemption, created_at, " +
              "orders:order_id ( id, order_number, payment_status, status, subtotal, total, created_at )",
          )
          .in("coupon_id", couponIds)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })

  if (redErr) {
    console.log("[v0] commissions: redemptions fetch error:", redErr)
  }

  // --- Shape into report rows -----------------------------------------------
  const includeUnpaid = sp.status === "all"
  const rows: RedemptionRow[] = []
  for (const r of redemptions ?? []) {
    const coupon = couponById.get(r.coupon_id as string)
    if (!coupon) continue
    // PostgREST returns the embedded relation as an array even for
    // a single FK — narrow it here so the client can be naive.
    const orderRaw = Array.isArray(r.orders) ? r.orders[0] : r.orders
    const paymentStatus = (orderRaw?.payment_status as string | null) ?? null
    const orderStatus = (orderRaw?.status as string | null) ?? null
    const isPaid = paymentStatus === "paid"
    // Drop unpaid rows unless the admin explicitly asked to see them.
    if (!includeUnpaid && !isPaid) continue
    // Skip cancelled / refunded outright — never commissionable.
    if (orderStatus === "cancelled" || orderStatus === "refunded") continue

    const amountOff = Number(r.amount_off ?? 0)
    const subtotalAtRedemption = Number(r.subtotal_at_redemption ?? 0)
    // Prefer the snapshot saved on the redemption row over the order's
    // current subtotal — the order might have been edited after the
    // fact, but the redemption snapshot is what the coupon was applied
    // against.
    const commissionableBase = Math.max(0, subtotalAtRedemption - amountOff)
    const rate = Number(coupon.commission_rate_percent ?? 0)
    const commission = round2(commissionableBase * (rate / 100))

    rows.push({
      redemptionId: r.id as string,
      orderId: (r.order_id as string) ?? null,
      orderNumber: (orderRaw?.order_number as string | null) ?? null,
      orderStatus,
      paymentStatus,
      createdAt: r.created_at as string,
      couponId: coupon.id as string,
      couponCode: coupon.code as string,
      affiliateName: (coupon.affiliate_name as string | null) ?? null,
      affiliateEmail: (coupon.affiliate_email as string | null) ?? null,
      commissionRatePercent: rate,
      amountOff,
      subtotalAtRedemption,
      commissionableBase,
      commission,
      isPaid,
    })
  }

  // --- Per-affiliate roll-up -------------------------------------------------
  // Group by affiliate name (case-insensitive) so the report can
  // tolerate minor casing drift between coupons for the same person.
  const groups = new Map<string, AffiliateRow>()
  for (const r of rows) {
    if (!r.affiliateName) continue
    const key = r.affiliateName.trim().toLowerCase()
    const prev = groups.get(key)
    if (prev) {
      prev.redemptions += 1
      prev.totalDiscountGiven = round2(prev.totalDiscountGiven + r.amountOff)
      prev.totalCommissionableBase = round2(
        prev.totalCommissionableBase + r.commissionableBase,
      )
      prev.totalCommission = round2(prev.totalCommission + r.commission)
      if (!prev.email && r.affiliateEmail) prev.email = r.affiliateEmail
    } else {
      groups.set(key, {
        name: r.affiliateName,
        email: r.affiliateEmail,
        couponCodes: Array.from(
          new Set(
            rows
              .filter(
                (rr) =>
                  rr.affiliateName?.trim().toLowerCase() === key,
              )
              .map((rr) => rr.couponCode),
          ),
        ),
        redemptions: 1,
        totalDiscountGiven: r.amountOff,
        totalCommissionableBase: r.commissionableBase,
        totalCommission: r.commission,
      })
    }
  }
  const affiliates = Array.from(groups.values()).sort(
    (a, b) => b.totalCommission - a.totalCommission,
  )

  // --- Totals strip ----------------------------------------------------------
  const totals = rows.reduce(
    (acc, r) => {
      acc.redemptions += 1
      acc.discount = round2(acc.discount + r.amountOff)
      acc.base = round2(acc.base + r.commissionableBase)
      acc.commission = round2(acc.commission + r.commission)
      return acc
    },
    { redemptions: 0, discount: 0, base: 0, commission: 0 },
  )

  return (
    <CommissionsClient
      fromIso={fromIso}
      toIso={toIso}
      includeUnpaid={includeUnpaid}
      affiliates={affiliates}
      redemptions={rows}
      totals={totals}
    />
  )
}

function parseDateOr(value: string | undefined, fallback: Date, endOfDay = false) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"))
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (endOfDay) {
    const d = new Date(fallback)
    d.setUTCHours(23, 59, 59, 999)
    return d.toISOString()
  }
  const d = new Date(fallback)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
