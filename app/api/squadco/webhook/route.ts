/**
 * Squadco webhook receiver.
 *
 * Squad POSTs a JSON event to this endpoint every time a payment
 * settles (or fails). The payload shape, cribbed from Squad's docs:
 *
 *   {
 *     "Event": "charge_successful",
 *     "TransactionRef": "SQCHIZ3634573076082",
 *     "Body": {
 *       "transaction_ref":      "SQCHIZ3634573076082",
 *       "transaction_status":   "success",
 *       "merchant_amount":       100000,   // in kobo — divide by 100
 *       "transaction_amount":    100000,
 *       "currency":              "NGN",
 *       ...
 *     }
 *   }
 *
 * Squad signs the raw request body with HMAC-SHA512 using the merchant
 * secret key and puts the hex digest in the `x-squad-encrypted-body`
 * header. We recompute the HMAC locally and constant-time compare
 * before trusting any field in the payload — this is the only thing
 * keeping a random attacker from POSTing `charge_successful` at us.
 *
 * The handler is idempotent: replaying the same webhook 100 times
 * produces the same DB state, and a late "failed" event cannot
 * regress a prior "paid".
 *
 * Deployment note: in the Squadco merchant dashboard, set the
 * webhook URL to `https://<your-domain>/api/squadco/webhook`. No
 * per-endpoint secret is needed — it's the same SQUADCO_SECRET_KEY
 * the rest of the server already uses.
 */
import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { squadcoStatusToPaymentStatus } from "@/lib/squadco"

// Squad signs the raw bytes of the request body. We must NOT let Next
// pre-parse the body, or the digest we compute will diverge from the
// one Squad sent. `runtime = "nodejs"` also guarantees `node:crypto`
// is available.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SquadWebhookBody = {
  Event?: string
  TransactionRef?: string
  Body?: {
    transaction_ref?: string
    transaction_status?: string
    merchant_amount?: number
    transaction_amount?: number
    currency?: string
    email?: string
    customer_id?: string
    [k: string]: unknown
  }
  [k: string]: unknown
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.SQUADCO_SECRET_KEY
  if (!secretKey) {
    // No secret configured means we can't validate the signature, which
    // means we can't trust any incoming webhook. 503 instead of 500 so
    // Squad's retry logic keeps hammering until an operator fixes the
    // env var — dropping the event on the floor would lose payments.
    console.error("[v0] squadco webhook: SQUADCO_SECRET_KEY missing")
    return NextResponse.json(
      { ok: false, error: "Card payments not configured." },
      { status: 503 },
    )
  }

  // Read the raw body ONCE as text — we need the exact bytes Squad
  // signed, not a re-stringified JSON (which can change whitespace
  // and key ordering and invalidate the HMAC).
  const rawBody = await req.text()

  const signatureHeader =
    req.headers.get("x-squad-encrypted-body") ||
    req.headers.get("X-Squad-Encrypted-Body")

  if (!signatureHeader) {
    console.warn("[v0] squadco webhook: missing x-squad-encrypted-body")
    return NextResponse.json(
      { ok: false, error: "Missing signature." },
      { status: 401 },
    )
  }

  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex")

  // Constant-time compare — prevents timing attacks that could leak
  // the expected signature one byte at a time. Both buffers must be
  // the same length for `timingSafeEqual` to not throw.
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signatureHeader.trim(), "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn("[v0] squadco webhook: signature mismatch", {
      got: signatureHeader.slice(0, 16) + "...",
      expectedPrefix: expected.slice(0, 16) + "...",
    })
    return NextResponse.json(
      { ok: false, error: "Invalid signature." },
      { status: 401 },
    )
  }

  // Signature verified — safe to parse and trust the payload.
  let event: SquadWebhookBody
  try {
    event = JSON.parse(rawBody) as SquadWebhookBody
  } catch (err) {
    console.error("[v0] squadco webhook: invalid JSON", err)
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 },
    )
  }

  const transactionRef =
    event.Body?.transaction_ref || event.TransactionRef || null
  const rawStatus = event.Body?.transaction_status ?? null

  if (!transactionRef) {
    // Nothing to reconcile against. Still respond 200 so Squad doesn't
    // retry forever — this is an event we genuinely can't handle.
    console.warn("[v0] squadco webhook: no transaction_ref in payload", {
      event: event.Event,
    })
    return NextResponse.json({ ok: true, ignored: true })
  }

  const mappedStatus = squadcoStatusToPaymentStatus(rawStatus)

  try {
    const supabase = createAdminClient()

    // Find the order. Squad's Payment Link flow doesn't round-trip a
    // metadata field, so we match in three ways and take the first hit:
    //   1. An order we've already stamped with this exact
    //      transaction_ref (set by an earlier webhook or redirect poll).
    //   2. An order whose squadco_hash matches the ref — only happens
    //      if Squad is echoing our merchant_transaction_ref back.
    //   3. Give up. We can't reliably match by amount alone because
    //      two customers might have equal-value carts in the same
    //      minute. Surface a loud warning so an operator can manually
    //      reconcile from the merchant dashboard.
    const { data: byRef } = await supabase
      .from("orders")
      .select("id, order_number, payment_status, squadco_hash")
      .eq("squadco_transaction_ref", transactionRef)
      .maybeSingle()

    let order = byRef ?? null
    if (!order) {
      const { data: byHash } = await supabase
        .from("orders")
        .select("id, order_number, payment_status, squadco_hash")
        .eq("squadco_hash", transactionRef)
        .maybeSingle()
      order = byHash ?? null
    }

    if (!order) {
      console.warn("[v0] squadco webhook: no matching order", {
        transactionRef,
        event: event.Event,
      })
      // 200 so Squad stops retrying — we've logged enough to
      // reconcile manually if it turns out to be real.
      return NextResponse.json({ ok: true, matched: false })
    }

    // Build the patch. Always refresh metadata, but only escalate
    // payment_status (never regress from paid → failed).
    const patch: Record<string, unknown> = {
      squadco_status: rawStatus,
      squadco_transaction_ref: transactionRef,
      squadco_amount_paid:
        event.Body?.merchant_amount ?? event.Body?.transaction_amount ?? null,
      squadco_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (mappedStatus === "paid" && order.payment_status !== "paid") {
      patch.payment_status = "paid"
    } else if (
      mappedStatus === "failed" &&
      order.payment_status !== "paid" &&
      order.payment_status !== "failed"
    ) {
      patch.payment_status = "failed"
    } else if (
      mappedStatus === "partial" &&
      order.payment_status !== "paid" &&
      order.payment_status !== "partial"
    ) {
      patch.payment_status = "partial"
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", order.id)

    if (updateErr) {
      console.error("[v0] squadco webhook: DB update failed", {
        orderId: order.id,
        error: updateErr.message,
      })
      // 500 so Squad retries — our DB is transiently sad, don't drop
      // the event.
      return NextResponse.json(
        { ok: false, error: "DB update failed." },
        { status: 500 },
      )
    }

    console.log("[v0] squadco webhook: reconciled", {
      orderNumber: order.order_number,
      mappedStatus,
      transactionRef,
    })
    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
      status: mappedStatus,
    })
  } catch (err) {
    console.error("[v0] squadco webhook: unhandled error", err)
    return NextResponse.json(
      { ok: false, error: "Unhandled error." },
      { status: 500 },
    )
  }
}
