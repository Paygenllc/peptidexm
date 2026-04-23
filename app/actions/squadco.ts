"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { squadcoStatusToPaymentStatus } from "@/lib/squadco"

/**
 * Squadco One-Time Payment Link generator.
 *
 * We deliberately use the *Payment Links* API (`POST /payment_link/otp`) and
 * not the direct-charge `/transaction/initiate` endpoint. Direct charge is
 * NGN-only on most merchant plans and fails USD transactions with a generic
 * "Minimum amount is 100 Naira" / "Transaction Failed" message. Payment
 * Links, by contrast, accept a `currencies` array with USD and render
 * Squadco's hosted page that already supports card rails.
 *
 * Flow:
 *   1. POST /payment_link/otp with {name, hash, amounts:[{amount,currency_id:"USD"}], ...}
 *   2. Squadco stores the link keyed by our `hash`
 *   3. Customer is redirected to `https://{env}pay.squadco.com/{hash}`
 *   4. On completion Squadco redirects the customer back to `redirect_link`
 *      (our checkout page). This merchant account has no webhook
 *      available, so we reconcile the order by having the checkout page
 *      call `verifyCardPaymentAction` on arrival — see below.
 *
 * Sandbox vs live is auto-detected from the key prefix:
 *   - `sandbox_sk_*` / `sk_test_*`  → https://sandbox-api-d.squadco.com + sandbox-pay.squadco.com
 *   - everything else (live)        → https://api-d.squadco.com        + pay.squadco.com
 *
 * Amounts for USD are in **cents** (integer). Squadco's Payment Links API
 * expects the same smallest-unit convention as direct charge.
 */

type SquadcoResult = { url: string; reference: string } | { error: string }

interface Input {
  orderNumber: string
  amountCents: number
  email: string
  firstName: string
  lastName: string
  redirectUrl: string
  /**
   * Currency code. Defaults to USD because Payment Links support card-USD
   * without the NGN minimums that block the direct-charge path.
   */
  currency?: "USD" | "NGN"
}

interface SquadcoPaymentLinkResponse {
  status?: number
  success?: boolean
  message?: string
  data?: {
    // Squadco returns the hash we sent, which is what we append to the
    // pay.squadco.com base URL to build the checkout URL.
    hash?: string
    // Some responses also include a ready-made URL — we prefer it when
    // present so we don't have to guess the public host.
    link?: string
    url?: string
  }
}

/**
 * Resolve API + public host pair based on key prefix. Both halves are needed:
 * the API host to create the link, the public host to send the customer to.
 */
function resolveHosts(secretKey: string): { api: string; pay: string } {
  const isSandbox =
    secretKey.startsWith("sandbox_") || secretKey.startsWith("sk_test_")
  return isSandbox
    ? {
        api: "https://sandbox-api-d.squadco.com",
        pay: "https://sandbox-pay.squadco.com",
      }
    : {
        api: "https://api-d.squadco.com",
        pay: "https://pay.squadco.com",
      }
}

/**
 * Build a URL-safe, globally-unique "hash" (Squadco's term for the link
 * slug). Squadco rejects hashes that collide with previous links, so we
 * derive it from our order number + a short timestamp suffix.
 *
 * Must match `[a-z0-9]+`, length ~16-32. We keep it short enough to look
 * clean in the pay.squadco.com URL but long enough to be effectively unique.
 */
function buildHash(orderNumber: string): string {
  const cleaned = orderNumber.toLowerCase().replace(/[^a-z0-9]/g, "")
  const suffix = Date.now().toString(36)
  return `${cleaned}${suffix}`.slice(0, 32)
}

export async function generateSquadcoPaymentLinkAction(
  input: Input,
): Promise<SquadcoResult> {
  const secretKey = process.env.SQUADCO_SECRET_KEY
  if (!secretKey) {
    console.error("[v0] SQUADCO_SECRET_KEY is not set")
    return { error: "Card payments are not configured. Contact support." }
  }

  // Squadco's Payment Links OTP endpoint is strict about allowed fields —
  // it ignores/rejects anything beyond the documented set — so we only
  // destructure what we actually send. Customer email/name are kept on the
  // order row in our DB and reconciled via the `hash` reference.
  const { orderNumber, amountCents, redirectUrl } = input

  // USD is the sensible default for Payment Links — it's why we're on this
  // endpoint rather than direct charge. Operators can still pin NGN via env
  // if their Squadco account is NGN-only.
  const currency: "USD" | "NGN" =
    input.currency ??
    (process.env.SQUADCO_CURRENCY === "NGN" ? "NGN" : "USD")

  const amount = Math.round(amountCents)
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error("[v0] Squadco: invalid amount", { amountCents })
    return { error: "Invalid order amount. Please refresh and try again." }
  }

  const hash = buildHash(orderNumber)
  const { api, pay } = resolveHosts(secretKey)
  const endpoint = `${api}/payment_link/otp`

  // Squadco requires an expiry timestamp for one-time links. 24h is plenty
  // for an online checkout — short enough that stale links don't linger,
  // long enough that a customer who opens the page overnight can still pay.
  const expireBy = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        // Label shown in the Squadco dashboard (internal reconciliation)
        // and on the hosted payment page. We intentionally keep this
        // neutral — no "PeptideXM" or product descriptors — so the
        // checkout page the customer sees on Squadco stays clean.
        name: `Order ${orderNumber}`,
        hash,
        // 1 = active, 0 = inactive. Must be 1 for customers to pay.
        link_status: 1,
        expire_by: expireBy,
        // Amounts is an array so a single link can offer multiple
        // currencies. We only ever offer one at a time.
        amounts: [
          {
            amount,
            currency_id: currency,
          },
        ],
        description: `Order ${orderNumber}`,
        redirect_link: redirectUrl,
        // Squadco's Payment Links API rejects any extra fields (including
        // `metadata`) with "not allowed", so we keep the payload minimal.
        // Customer context (email, name) lives on our order row — the link
        // is reconciled back via the `hash`, which we persist as the order's
        // payment reference.
        return_msg: "Thank you for your order. Your payment is being processed.",
      }),
    })

    const rawBody = await response.text()
    let parsed: SquadcoPaymentLinkResponse | null = null
    try {
      parsed = rawBody
        ? (JSON.parse(rawBody) as SquadcoPaymentLinkResponse)
        : null
    } catch {
      // Fall through to error logging below.
    }

    // Like `/transaction/initiate`, the Payment Links endpoint often returns
    // HTTP 200 with `success: false` for business-logic failures, so we have
    // to check both the HTTP status and the body.
    if (!response.ok || !parsed?.success) {
      console.error("[v0] Squadco payment_link/otp failed", {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        environment: api.includes("sandbox") ? "sandbox" : "live",
        currency,
        amount,
        hash,
        responseBody: parsed ?? rawBody.slice(0, 1000),
      })

      if (response.status === 401 || response.status === 403) {
        return {
          error:
            "Card payments are temporarily unavailable (authentication failed). Please use Zelle or USDT for now.",
        }
      }

      const providerMessage =
        parsed?.message && typeof parsed.message === "string"
          ? parsed.message
          : null

      return {
        error: providerMessage
          ? `Payment provider: ${providerMessage}`
          : `Payment service error (${response.status}). Please try again or contact support.`,
      }
    }

    // Prefer a URL explicitly returned by Squadco. Fall back to building one
    // from the hash + public host — this is documented behavior for OTP
    // links, so the deterministic form is safe.
    const checkoutUrl =
      parsed.data?.link ||
      parsed.data?.url ||
      (parsed.data?.hash ? `${pay}/${parsed.data.hash}` : `${pay}/${hash}`)

    return { url: checkoutUrl, reference: hash }
  } catch (err) {
    console.error("[v0] Squadco payment_link/otp threw", err)
    return {
      error:
        "Could not reach the payment service. Please check your connection and try again.",
    }
  }
}

/**
 * Persist the Squadco payment link on the order row so the verify
 * endpoint can match incoming payment confirmations back to this order.
 *
 * Because there's no webhook available for this merchant, reconciliation
 * happens on redirect: the customer comes back with `?order=<num>`
 * appended to the URL, we look up the order, and we pull status from
 * Squadco's `/transaction/verify/{hash}` endpoint. Writing the hash to
 * the order row (indexed via `orders_squadco_hash_idx` from migration
 * 019) is what makes that pull possible.
 *
 * Runs server-side with the admin client because order rows are
 * RLS-locked from the anon role during the "post-placement" window.
 * The caller is trusted (our own checkout page, right after it just
 * placed this exact order), so no additional auth is performed here.
 */
export async function persistSquadcoLinkToOrderAction(input: {
  orderId: string
  hash: string
  checkoutUrl: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orderId, hash, checkoutUrl } = input

  if (!orderId || !hash) {
    return { ok: false, error: "Missing order id or hash." }
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("orders")
      .update({
        squadco_hash: hash,
        squadco_checkout_url: checkoutUrl,
        squadco_updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (error) {
      console.error("[v0] persistSquadcoLinkToOrderAction update error:", error.message)
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (err) {
    console.error("[v0] persistSquadcoLinkToOrderAction threw:", err)
    return { ok: false, error: "Failed to link payment to order." }
  }
}

/**
 * Verify a card payment by looking up the order's Squadco hash and
 * asking Squadco what happened. This is the redirect-mode replacement
 * for a webhook: the customer lands on `/checkout?card_success=true&order=<num>`
 * after paying, we look up the order, and we pull the status from
 * `GET /transaction/verify/{hash}`.
 *
 * Idempotent and safe to call many times:
 *   - If the order is already `paid`, we no-op and report `alreadyPaid`.
 *   - If the order has no `squadco_hash`, we report `notLinked` — this
 *     happens when the link was generated but the order hasn't been
 *     placed yet, or when a customer hits the success URL for an order
 *     that was paid via a different method.
 *   - If Squadco says the transaction isn't `success`, we return the
 *     mapped status so the caller can show a "still processing" state
 *     and optionally poll again.
 *
 * Only escalates payment_status — never regresses it. (A late "failed"
 * after a successful charge must not wipe the paid state.)
 */
export async function verifyCardPaymentAction(input: {
  orderNumber: string
  /**
   * Squad's own transaction_ref (e.g. `SQCHIZ3634573076082`). Payment
   * Link orders do NOT share the link hash with the charge ref — the
   * hash only identifies the checkout URL, and a fresh transaction_ref
   * is minted when the customer actually pays. Squad appends this ref
   * to our redirect URL as `?transaction_ref=...`, and the webhook
   * payload includes it in `Body.transaction_ref`.
   *
   * When we have it, we query `/transaction/verify/{transaction_ref}`
   * directly, which is the only way to get a meaningful response for
   * Payment Link charges. When absent (old clients, retry polls before
   * Squad redirects), we fall back to the hash lookup.
   */
  transactionRef?: string
}): Promise<
  | { ok: true; status: "paid" | "failed" | "partial" | "pending"; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  const { orderNumber, transactionRef } = input
  if (!orderNumber) return { ok: false, error: "Missing order number." }

  const secretKey = process.env.SQUADCO_SECRET_KEY
  if (!secretKey) {
    return { ok: false, error: "Card payments are not configured." }
  }

  try {
    const supabase = createAdminClient()

    // Look up the order by its user-facing order_number. We need both
    // the squadco_hash + stored transaction_ref (to ask Squadco) and
    // the current payment_status (so we can avoid regressing it).
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, payment_status, squadco_hash, squadco_status, squadco_transaction_ref, total",
      )
      .eq("order_number", orderNumber)
      .maybeSingle()

    if (orderErr) {
      console.error("[v0] verifyCardPaymentAction lookup error:", orderErr.message)
      return { ok: false, error: "Could not look up your order." }
    }
    if (!order) return { ok: false, error: "Order not found." }

    // Already settled — nothing to do. Report success so the UI can
    // show the "paid" panel without us hitting Squadco again.
    if (order.payment_status === "paid") {
      return { ok: true, status: "paid", alreadyPaid: true }
    }

    // Decide which reference to query Squadco with. Priority:
    //   1. The caller-provided transactionRef (freshest — comes from
    //      Squad's own redirect URL the instant the charge settles).
    //   2. Whatever transaction_ref we've already persisted (from an
    //      earlier verify pass or the webhook handler).
    //   3. The payment-link hash, as a best-effort fallback. For pure
    //      Payment Link checkouts the hash will NOT resolve against
    //      `/transaction/verify` — that endpoint only speaks charge
    //      refs — so this path generally returns `pending` until we
    //      get a real ref from the redirect or webhook.
    const verifyRef =
      transactionRef ||
      order.squadco_transaction_ref ||
      order.squadco_hash

    if (!verifyRef) {
      console.warn(
        "[v0] verifyCardPaymentAction: order has no squadco_hash or transaction_ref",
        { orderNumber, orderId: order.id },
      )
      return { ok: false, error: "Payment not linked to this order." }
    }

    const isSandbox =
      secretKey.startsWith("sandbox_") || secretKey.startsWith("sk_test_")
    const apiHost = isSandbox
      ? "https://sandbox-api-d.squadco.com"
      : "https://api-d.squadco.com"

    const verifyUrl = `${apiHost}/transaction/verify/${encodeURIComponent(verifyRef)}`

    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      // Squadco's dev network can be slow; a short server timeout
      // prevents this action from blocking the UI indefinitely.
      signal: AbortSignal.timeout(10_000),
    })

    const rawBody = await response.text()
    let parsed: {
      status?: number
      success?: boolean
      message?: string
      data?: {
        transaction_status?: string
        transaction_ref?: string
        transaction_amount?: number
        merchant_amount?: number
        currency?: string
      }
    } | null = null
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null
    } catch {
      // Fall through to error handling below.
    }

    if (!response.ok || !parsed?.success) {
      console.error("[v0] Squadco verify failed", {
        status: response.status,
        statusText: response.statusText,
        verifyRef,
        hash: order.squadco_hash,
        body: parsed ?? rawBody.slice(0, 500),
      })
      // Not a hard failure from the customer's perspective — Squadco
      // sometimes takes a few seconds to surface the charge. Tell the
      // UI to treat this as still-pending so it can retry.
      return { ok: true, status: "pending", alreadyPaid: false }
    }

    const mappedStatus = squadcoStatusToPaymentStatus(
      parsed.data?.transaction_status,
    )

    // Stage the update. Only touch payment_status if this is an
    // escalation — don't let a stale "failed" reverse a prior "paid".
    const update: Record<string, unknown> = {
      squadco_status: parsed.data?.transaction_status ?? null,
      squadco_transaction_ref: parsed.data?.transaction_ref ?? null,
      squadco_amount_paid: parsed.data?.merchant_amount ?? parsed.data?.transaction_amount ?? null,
      squadco_updated_at: new Date().toISOString(),
    }

    if (mappedStatus === "paid" && order.payment_status !== "paid") {
      update.payment_status = "paid"
    } else if (mappedStatus === "failed" && order.payment_status !== "paid") {
      update.payment_status = "failed"
    } else if (mappedStatus === "partial" && order.payment_status !== "paid") {
      update.payment_status = "partial"
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.id)

    if (updateErr) {
      console.error("[v0] verifyCardPaymentAction update error:", updateErr.message)
      // Squadco's answer is still authoritative — return the status we
      // derived so the UI shows the right state even if our DB write
      // failed. An admin will see the mismatch in the dashboard.
      return { ok: true, status: mappedStatus, alreadyPaid: false }
    }

    return { ok: true, status: mappedStatus, alreadyPaid: false }
  } catch (err) {
    console.error("[v0] verifyCardPaymentAction threw:", err)
    // Network/timeout errors aren't fatal — return pending so the UI
    // can retry on its own.
    return { ok: true, status: "pending", alreadyPaid: false }
  }
}
