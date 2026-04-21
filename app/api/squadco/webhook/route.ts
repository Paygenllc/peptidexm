import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  verifySquadcoSignature,
  squadcoStatusToPaymentStatus,
  extractSquadcoHash,
  type SquadcoWebhookPayload,
} from "@/lib/squadco"

/**
 * Squadco payment webhook.
 *
 * Squadco POSTs this endpoint when a Payment Link transitions state
 * (mostly on successful charge, occasionally on failure/reversal). We:
 *
 *   1. Read the raw body so we can verify the HMAC-SHA512 signature
 *      (Squadco sends it in `x-squad-encrypted-body`).
 *   2. Parse the payload and extract the `hash` / `transaction_ref`
 *      that ties the webhook to one of our orders.
 *   3. Update the matching `orders` row idempotently — never regress
 *      a `paid` order back to `pending`, and never overwrite a
 *      settled payment_status with an earlier lifecycle state.
 *
 * Runs in the Node.js runtime because we need `crypto.timingSafeEqual`,
 * and is `force-dynamic` so edge/static caches never intercept the POST.
 *
 * Webhook secret: Squadco signs with the merchant secret key by default.
 * If the merchant dashboard has a separate "Webhook Secret" configured,
 * set `SQUADCO_WEBHOOK_SECRET` and it takes precedence.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-squad-encrypted-body")

  const secret =
    process.env.SQUADCO_WEBHOOK_SECRET ||
    process.env.SQUADCO_SECRET_KEY ||
    ""

  if (!secret) {
    console.error("[squadco/webhook] no signing secret configured")
    return NextResponse.json(
      { ok: false, error: "server misconfigured" },
      { status: 500 },
    )
  }

  if (!verifySquadcoSignature(rawBody, signature, secret)) {
    console.warn("[squadco/webhook] invalid signature", {
      hasHeader: !!signature,
      bodyLength: rawBody.length,
    })
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    )
  }

  let payload: SquadcoWebhookPayload
  try {
    payload = JSON.parse(rawBody) as SquadcoWebhookPayload
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 },
    )
  }

  const hash = extractSquadcoHash(payload)
  if (!hash) {
    // Nothing we can match — ack 200 so Squadco stops retrying an
    // unmatchable payload. Logged loudly so we can investigate.
    console.warn("[squadco/webhook] no hash/reference in payload", {
      keys: Object.keys(payload),
    })
    return NextResponse.json({ ok: true, note: "no matchable reference" })
  }

  const supabase = createAdminClient()

  // Find the order this webhook is about. We look up by `squadco_hash`
  // first (populated when the checkout page persists the link); if that
  // misses, we also try `squadco_transaction_ref` in case the webhook
  // fired after a retry that set that column first.
  const { data: order, error: loadErr } = await supabase
    .from("orders")
    .select("id, payment_status, squadco_status, total, squadco_hash")
    .or(`squadco_hash.eq.${hash},squadco_transaction_ref.eq.${hash}`)
    .maybeSingle()

  if (loadErr) {
    console.error("[squadco/webhook] order lookup error:", loadErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  if (!order) {
    console.warn("[squadco/webhook] unknown hash:", hash)
    return NextResponse.json({ ok: true, note: "unknown order" })
  }

  // If we've already marked it paid, don't re-process — treat the
  // webhook as idempotent. Squadco retries on 5xx, so returning 200 is
  // important to stop the retry loop once we've settled the order.
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true, note: "already paid" })
  }

  // Pull status + amount + transaction_ref out of whichever shape
  // Squadco used. The helper's shape accepts both `Body.*` and flat
  // envelopes; we normalize at the field level here.
  const rawStatus =
    payload.Body?.transaction_status ??
    payload.data?.transaction_status ??
    payload.transaction_status ??
    null
  const transactionRef =
    payload.Body?.transaction_ref ??
    payload.data?.transaction_ref ??
    payload.transaction_ref ??
    payload.TransactionRef ??
    null
  const amount =
    payload.Body?.amount ??
    payload.data?.amount ??
    payload.amount ??
    null

  const mappedStatus = squadcoStatusToPaymentStatus(rawStatus)

  const update: Record<string, unknown> = {
    squadco_status: rawStatus,
    squadco_transaction_ref: transactionRef,
    squadco_amount_paid: typeof amount === "number" ? amount : null,
    squadco_updated_at: new Date().toISOString(),
  }

  // Only escalate payment_status; never regress it. If a late/retry
  // webhook arrives with an earlier state, we keep the settled one.
  if (mappedStatus === "paid" && order.payment_status !== "paid") {
    update.payment_status = "paid"
    update.paid_at = new Date().toISOString()
    update.status = "processing"
  } else if (mappedStatus === "failed" && order.payment_status !== "paid") {
    update.payment_status = "failed"
  } else if (mappedStatus === "partial" && order.payment_status !== "paid") {
    // Underpayment — flag for manual review rather than auto-fulfilling.
    update.payment_status = "partial"
  }

  const { error: upErr } = await supabase
    .from("orders")
    .update(update)
    .eq("id", order.id)

  if (upErr) {
    console.error("[squadco/webhook] update error:", upErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
