import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { couponErrorMessage, type ValidatedCoupon } from "@/lib/coupons"

/**
 * POST /api/coupons/validate
 *
 * Stateless validate endpoint the checkout calls when the customer
 * applies a code in the order summary. We do the validation server-
 * side via the `validate_coupon` SECURITY DEFINER RPC so:
 *
 *   1. The percent/fixed math is computed by the same code path that
 *      will eventually redeem the coupon — no client-side drift.
 *   2. RLS on `coupons` stays admin-only; the RPC is the only door
 *      anonymous users can knock on, and it never leaks rows it
 *      doesn't intend to.
 *
 * IMPORTANT: validation is non-binding. It does NOT decrement
 * `redemption_count` or insert into `coupon_redemptions`. The actual
 * redemption happens inside `placeOrderAction` once the order row
 * exists, so a customer abandoning checkout never burns a use.
 */
export async function POST(req: Request) {
  let body: { code?: string; email?: string; subtotal?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    )
  }

  const code = (body.code ?? "").trim()
  const email = (body.email ?? "").trim()
  // Subtotal must be a finite, non-negative number. Anything else is
  // either tampering or a bug in the client; refuse early so we don't
  // hand the RPC a NaN that becomes confusing to debug later.
  const subtotal = Number(body.subtotal)
  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Enter a coupon code." },
      { status: 400 },
    )
  }
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid order subtotal." },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code,
    p_email: email || null,
    p_subtotal: subtotal,
  })

  if (error) {
    return NextResponse.json(
      { ok: false, error: couponErrorMessage(error.message) },
      { status: 200 }, // 200 + ok:false — UI prefers this shape
    )
  }

  // RPC returns SETOF; first row is the coupon. Postgres NUMERICs
  // come back as strings, so coerce to Number at the boundary.
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "We couldn't find that coupon code." },
      { status: 200 },
    )
  }

  const coupon: ValidatedCoupon = {
    couponId: row.coupon_id as string,
    code: row.code as string,
    type: row.type as "percent" | "fixed",
    value: Number(row.value),
    amountOff: Number(row.amount_off),
  }

  return NextResponse.json({ ok: true, coupon })
}
