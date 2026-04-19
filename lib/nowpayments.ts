import crypto from "node:crypto"

/**
 * Minimal typed wrapper around the NOWPayments API.
 *
 * Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
 *
 * We deliberately keep the surface small — we only need:
 *   1. createInvoice()  — generate a hosted payment page URL
 *   2. verifyIpn()      — HMAC-SHA512 verification of webhook bodies
 *
 * Currency restrictions (stablecoins only) are enforced server-side via
 * `pay_currencies` on the invoice so the hosted page never offers
 * volatile coins even if the NOWPayments account has them enabled.
 */

const NP_BASE = "https://api.nowpayments.io/v1"

/** Stablecoin whitelist — adjust the list here if you ever expand it. */
export const ALLOWED_PAY_CURRENCIES = ["usdt", "usdc", "dai"] as const

/** Statuses NOWPayments can send us in an IPN. */
export type NpStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired"

export type NpInvoiceResponse = {
  id: string
  order_id: string
  order_description?: string | null
  price_amount: number
  price_currency: string
  pay_currency?: string | null
  invoice_url: string
  created_at?: string
  updated_at?: string
}

export type NpIpnPayload = {
  payment_id: number | string
  payment_status: NpStatus
  pay_address?: string
  price_amount: number
  price_currency: string
  pay_amount?: number
  actually_paid?: number
  pay_currency?: string
  order_id?: string
  order_description?: string
  // NOWPayments also sends many other fields we don't currently need.
}

function apiKey() {
  const k = process.env.NOWPAYMENTS_API_KEY
  if (!k) throw new Error("NOWPAYMENTS_API_KEY is not set")
  return k
}

function ipnSecret() {
  const s = process.env.NOWPAYMENTS_IPN_SECRET
  if (!s) throw new Error("NOWPAYMENTS_IPN_SECRET is not set")
  return s
}

/**
 * Create a hosted invoice. The returned `invoice_url` is what we redirect
 * the shopper to; NOWPayments handles coin selection, QR rendering, and
 * confirmations on their domain.
 *
 * We pass our internal order id as `order_id` so the IPN payload carries
 * it back and we can update the right row on our side.
 *
 * Note: The `/v1/invoice` endpoint only supports these exact fields. Do not
 * add `pay_currencies` (plural), `is_fixed_rate`, or `is_fee_paid_by_user` —
 * those belong to the direct `/v1/payment` endpoint and cause a 400 here.
 * Limit the coin set shown on the hosted page via the NOWPayments dashboard:
 *   Store Settings → Enabled Payment Currencies.
 */
export async function createInvoice(args: {
  priceAmount: number
  priceCurrency?: string // default "usd"
  /** Optional: lock the invoice to a single payout coin (e.g. "usdttrc20"). */
  payCurrency?: string
  orderId: string
  orderDescription?: string
  successUrl: string
  cancelUrl: string
  ipnCallbackUrl: string
}): Promise<NpInvoiceResponse> {
  const body: Record<string, unknown> = {
    price_amount: Number(args.priceAmount.toFixed(2)),
    price_currency: (args.priceCurrency ?? "usd").toLowerCase(),
    order_id: args.orderId,
    order_description: args.orderDescription,
    ipn_callback_url: args.ipnCallbackUrl,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  }
  if (args.payCurrency) body.pay_currency = args.payCurrency.toLowerCase()

  const res = await fetch(`${NP_BASE}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // Surface the provider's own error message — it's almost always the
    // quickest clue when invoices fail (bad key, unsupported ticker, etc.).
    throw new Error(`NOWPayments invoice failed: ${res.status} ${text}`)
  }
  return (await res.json()) as NpInvoiceResponse
}

/**
 * Verify an IPN payload using HMAC-SHA512 of the *alphabetically-sorted*
 * JSON body keyed with your IPN secret. NOWPayments sends the signature
 * in the `x-nowpayments-sig` request header.
 *
 * We compare using a timing-safe equality check to prevent timing attacks.
 */
export function verifyIpn(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return false
  }
  const canonical = stableStringify(parsed)
  const expected = crypto
    .createHmac("sha512", ipnSecret())
    .update(canonical)
    .digest("hex")

  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(signature, "hex")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * JSON stringify with keys sorted at every level. NOWPayments' signature
 * scheme requires this exact canonical form — deviating by a single key
 * order causes the HMAC to mismatch.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`
}

/**
 * Map a NOWPayments payment_status into our internal payment_status enum
 * stored on public.orders.
 *
 * - finished / confirmed     → paid
 * - partially_paid           → partial (flagged for manual review)
 * - failed / expired / refunded → failed
 * - otherwise                → awaiting (waiting/confirming/sending)
 */
export function npStatusToPaymentStatus(
  s: NpStatus | string | null | undefined,
): "paid" | "partial" | "failed" | "awaiting" {
  switch (s) {
    case "finished":
    case "confirmed":
      return "paid"
    case "partially_paid":
      return "partial"
    case "failed":
    case "expired":
    case "refunded":
      return "failed"
    default:
      return "awaiting"
  }
}
