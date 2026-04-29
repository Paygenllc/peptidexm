/**
 * Stryd Pay webhook receiver.
 *
 * Stryd POSTs a JSON event to this endpoint when a payment completes.
 * The payload shape is documented in the Stryd Pay developer guide:
 *
 *   {
 *     "event": "payment.completed",
 *     "tx_ref": "stryd-api-1777451334372-uuyd3si",
 *     "flutterwave_tx_id": "9876543",
 *     "amount": 25.00,
 *     "currency": "USD",
 *     "fee_amount": 1.25,
 *     "net_amount": 23.75,
 *     "customer_name": "Jane Buyer",
 *     "customer_email": "buyer@example.com",
 *     "status": "successful",
 *     "metadata": { "order_id": "...", "order_number": "..." },
 *     "paid_at": "2026-04-29T08:35:12Z"
 *   }
 *
 * Stryd signs the raw request body with HMAC-SHA256 using the merchant
 * webhook secret and puts the hex digest in the `X-Stryd-Signature-256`
 * header (with a `sha256=` prefix). We recompute the HMAC locally and
 * constant-time compare before trusting any field.
 *
 * The handler is idempotent: replaying the same webhook 100 times
 * produces the same DB state, and a late "failed" event cannot regress
 * a prior "paid".
 *
 * Deployment note: in your Stryd dashboard, set the merchant webhook
 * URL to `https://<your-domain>/api/stryd/webhook` and copy the
 * generated webhook secret into `STRYD_WEBHOOK_SECRET`. The api key
 * (`STRYD_API_KEY`) is separate — it goes on the outbound calls in
 * app/actions/stryd.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { strydStatusToPaymentStatus } from "@/lib/stryd"

// Stryd signs the raw bytes of the request body. We must NOT let Next
// pre-parse the body, or the digest we compute will diverge from the
// one Stryd sent. `runtime = "nodejs"` also guarantees `node:crypto`
// is available.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type StrydWebhookEvent = {
  event?: string
  tx_ref?: string
  flutterwave_tx_id?: string
  amount?: number
  currency?: string
  fee_amount?: number
  net_amount?: number
  customer_name?: string
  customer_email?: string
  status?: string
  metadata?: { order_id?: string; order_number?: string; [k: string]: unknown }
  paid_at?: string
  [k: string]: unknown
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRYD_WEBHOOK_SECRET
  if (!secret) {
    // Same pattern as the Squadco handler: 503 (not 500) because we
    // want Stryd's retry logic to keep hammering until an operator
    // sets the env var. Dropping the event would lose payments.
    console.error("[v0] stryd webhook: STRYD_WEBHOOK_SECRET missing")
    return NextResponse.json(
      { ok: false, error: "Card payments not configured." },
      { status: 503 },
    )
  }

  // Read the raw body ONCE as text — we need the exact bytes Stryd
  // signed, not a re-stringified JSON.
  const rawBody = await req.text()

  // Stryd documents X-Stryd-Signature-256 (with `sha256=` prefix) as
  // the canonical signature header. The legacy X-Stryd-Signature
  // header carries the same digest but is also accepted as a fallback
  // for older deployments.
  const sigHeader =
    req.headers.get("x-stryd-signature-256") ||
    req.headers.get("X-Stryd-Signature-256") ||
    req.headers.get("x-stryd-signature") ||
    req.headers.get("X-Stryd-Signature")

  if (!sigHeader) {
    console.warn("[v0] stryd webhook: missing X-Stryd-Signature-256")
    return NextResponse.json(
      { ok: false, error: "Missing signature." },
      { status: 401 },
    )
  }

  // Strip the `sha256=` prefix if present. The HMAC computation is
  // identical either way; we just need to compare apples to apples.
  const provided = sigHeader.trim().replace(/^sha256=/i, "")
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")

  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(provided, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn("[v0] stryd webhook: signature mismatch", {
      gotPrefix: provided.slice(0, 16) + "...",
      expectedPrefix: expected.slice(0, 16) + "...",
    })
    return NextResponse.json(
      { ok: false, error: "Invalid signature." },
      { status: 401 },
    )
  }

  let event: StrydWebhookEvent
  try {
    event = JSON.parse(rawBody) as StrydWebhookEvent
  } catch (err) {
    console.error("[v0] stryd webhook: invalid JSON", err)
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 },
    )
  }

  const txRef = event.tx_ref || null
  const orderNumberFromMeta = event.metadata?.order_number || null

  if (!txRef && !orderNumberFromMeta) {
    // Stryd should always send tx_ref, and our checkout creator always
    // sends order_number in metadata. Missing both means we can't
    // reconcile. Still respond 200 so Stryd doesn't retry forever.
    console.warn("[v0] stryd webhook: nothing to reconcile against", {
      event: event.event,
    })
    return NextResponse.json({ ok: true, ignored: true })
  }

  // Webhook says "successful"; the per-event `status` field is what we
  // map. Stryd also sets `event: payment.completed` on the same row,
  // so we use that as a secondary signal when status is missing.
  const mappedStatus = strydStatusToPaymentStatus(
    event.status || (event.event === "payment.completed" ? "completed" : null),
  )

  try {
    const supabase = createAdminClient()

    // Match in two ways, in priority order:
    //   1. The tx_ref we persisted at link-creation time. This is the
    //      authoritative key; one tx_ref maps to exactly one order.
    //   2. The order_number we echoed back via metadata. Fallback for
    //      the rare case where the row is missing a tx_ref (e.g. an
    //      order placed before the migration ran but paid afterward).
    let order: {
      id: string
      order_number: string
      payment_status: string | null
    } | null = null

    if (txRef) {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, payment_status")
        .eq("stryd_tx_ref", txRef)
        .maybeSingle()
      order = data ?? null
    }

    if (!order && orderNumberFromMeta) {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, payment_status")
        .eq("order_number", orderNumberFromMeta)
        .maybeSingle()
      order = data ?? null
    }

    if (!order) {
      console.warn("[v0] stryd webhook: no matching order", {
        txRef,
        orderNumberFromMeta,
        event: event.event,
      })
      // 200 so Stryd stops retrying; we've logged enough to manually
      // reconcile from the merchant dashboard if needed.
      return NextResponse.json({ ok: true, matched: false })
    }

    const patch: Record<string, unknown> = {
      stryd_tx_ref: txRef ?? undefined,
      stryd_status: event.status ?? event.event ?? null,
      stryd_amount_paid: event.amount ?? null,
      stryd_fee_amount: event.fee_amount ?? null,
      stryd_net_amount: event.net_amount ?? null,
      stryd_paid_at: event.paid_at ?? null,
      stryd_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Same escalation rules as Squadco: never regress a paid order.
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

    // undefined values would cause Supabase to attempt a NULL update;
    // strip them so the patch is exactly the keys we care about.
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) delete patch[k]
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", order.id)

    if (updateErr) {
      console.error("[v0] stryd webhook: DB update failed", {
        orderId: order.id,
        error: updateErr.message,
      })
      // 500 so Stryd retries.
      return NextResponse.json(
        { ok: false, error: "DB update failed." },
        { status: 500 },
      )
    }

    console.log("[v0] stryd webhook: reconciled", {
      orderNumber: order.order_number,
      mappedStatus,
      txRef,
    })
    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
      status: mappedStatus,
    })
  } catch (err) {
    console.error("[v0] stryd webhook: unhandled error", err)
    return NextResponse.json(
      { ok: false, error: "Unhandled error." },
      { status: 500 },
    )
  }
}
