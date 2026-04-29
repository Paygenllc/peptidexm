"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { STRYD_API_BASE, strydStatusToPaymentStatus } from "@/lib/stryd"
import { getPaymentReturnOrigin } from "@/lib/payment-return-origin"

/**
 * Stryd Pay hosted-checkout integration.
 *
 * Mirrors the call signature of the Squadco actions on purpose so the
 * dispatcher in app/actions/card-payment.ts can route between them
 * without the checkout page (or any other caller) caring which
 * processor is active.
 *
 * Differences worth flagging vs Squadco:
 *
 *   - Stryd amounts are dollars (numbers, up to $10,000), not cents.
 *     We accept `amountCents` from the dispatcher and divide here so
 *     the cross-processor contract stays uniform.
 *   - Stryd ALWAYS settles in USD. The `currency` field defaults to
 *     "USD" and we don't expose an override.
 *   - Stryd rounds to two decimals by API design. Anything finer is
 *     truncated, so we round defensively here too.
 *   - Stryd returns its own `tx_ref` (e.g. "stryd-api-...-uuyd3si").
 *     We persist it as `stryd_tx_ref` on the order row and feed it
 *     back to the verify endpoint to reconcile.
 */

interface CreateInput {
  orderNumber: string
  amountCents: number
  email: string
  firstName: string
  lastName: string
  redirectUrl: string
}

type CreateResult = { url: string; reference: string } | { error: string }

interface StrydCheckoutResponse {
  checkout_url?: string
  tx_ref?: string
  amount?: number
  currency?: string
  mode?: string
  // Errors from the Edge Function come back as `{ error, message }`.
  error?: string
  message?: string
}

export async function generateStrydPaymentLinkAction(
  input: CreateInput,
): Promise<CreateResult> {
  const apiKey = process.env.STRYD_API_KEY
  if (!apiKey) {
    console.error("[v0] STRYD_API_KEY is not set")
    return { error: "Card payments are not configured. Contact support." }
  }

  const dollars = Math.round(input.amountCents) / 100
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { error: "Invalid order amount. Please refresh and try again." }
  }
  if (dollars > 10_000) {
    // Documented Stryd ceiling. We catch it here so the customer
    // gets a clear message instead of a 400 from the API.
    return {
      error:
        "Card payments are limited to $10,000 per transaction. Please contact support to split this order.",
    }
  }

  // Build the webhook + redirect URLs. We prefer the explicit override
  // env (NEXT_PUBLIC_PAYMENT_RETURN_ORIGIN) so the merchant dashboard
  // can show a neutral domain, falling back to the deployed origin.
  const origin = getPaymentReturnOrigin()
  const callbackUrl = `${origin}/api/stryd/webhook`

  const customerName =
    `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || undefined

  try {
    const response = await fetch(`${STRYD_API_BASE}/api-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        amount: dollars,
        currency: "USD",
        customer_email: input.email,
        customer_name: customerName,
        callback_url: callbackUrl,
        // The redirect URL is what the customer's browser lands on
        // after paying. Caller already includes ?card_success=true&
        // order=<num>, which is what the checkout page parses to
        // trigger verifyCardPaymentAction.
        redirect_url: input.redirectUrl,
        metadata: {
          // Echoed back unchanged on the webhook. We send both ids so
          // the webhook can short-circuit to the right order row even
          // if our DB lookup by tx_ref fails for some reason.
          order_number: input.orderNumber,
        },
      }),
      // Stryd's gateway is generally fast, but a hung connection here
      // would block the checkout page. 10s is plenty.
      signal: AbortSignal.timeout(10_000),
    })

    const rawBody = await response.text()
    let parsed: StrydCheckoutResponse | null = null
    try {
      parsed = rawBody ? (JSON.parse(rawBody) as StrydCheckoutResponse) : null
    } catch {
      // fall through to error logging
    }

    if (!response.ok || !parsed?.checkout_url || !parsed?.tx_ref) {
      console.error("[v0] Stryd api-checkout failed", {
        status: response.status,
        statusText: response.statusText,
        amount: dollars,
        body: parsed ?? rawBody.slice(0, 1000),
      })
      if (response.status === 401 || response.status === 403) {
        return {
          error:
            "Card payments are temporarily unavailable (authentication failed). Please use Zelle or USDT for now.",
        }
      }
      if (response.status === 429) {
        return {
          error:
            "Too many checkout attempts. Please wait a moment and try again.",
        }
      }
      const providerMsg =
        (parsed?.error || parsed?.message)?.toString().trim() || null
      return {
        error: providerMsg
          ? `Payment provider: ${providerMsg}`
          : `Payment service error (${response.status}). Please try again or contact support.`,
      }
    }

    return { url: parsed.checkout_url, reference: parsed.tx_ref }
  } catch (err) {
    console.error("[v0] Stryd api-checkout threw", err)
    return {
      error:
        "Could not reach the payment service. Please check your connection and try again.",
    }
  }
}

/**
 * Persist the Stryd tx_ref + checkout URL on the order row so the
 * webhook and verify-on-redirect paths can match incoming charges
 * back to this order. Direct counterpart to
 * `persistSquadcoLinkToOrderAction`.
 */
export async function persistStrydLinkToOrderAction(input: {
  orderId: string
  txRef: string
  checkoutUrl: string
  redirectUrl: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orderId, txRef, checkoutUrl, redirectUrl } = input
  if (!orderId || !txRef) {
    return { ok: false, error: "Missing order id or tx_ref." }
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("orders")
      .update({
        stryd_tx_ref: txRef,
        stryd_checkout_url: checkoutUrl,
        stryd_redirect_url: redirectUrl,
        stryd_updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (error) {
      console.error(
        "[v0] persistStrydLinkToOrderAction update error:",
        error.message,
      )
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    console.error("[v0] persistStrydLinkToOrderAction threw:", err)
    return { ok: false, error: "Failed to link payment to order." }
  }
}

/**
 * Verify a Stryd payment by polling Stryd's status endpoint and
 * mirroring the result onto the order row. Same idempotency guarantees
 * as the Squadco variant: only escalates payment_status, never
 * regresses it; safe to call repeatedly; tolerant of network blips.
 */
export async function verifyStrydPaymentAction(input: {
  orderNumber: string
  /**
   * Optional fresh tx_ref from the redirect URL. Stryd appends the
   * tx_ref to our redirect (along with `status`), so the checkout page
   * can pass it through here verbatim. When absent we use whatever
   * tx_ref we persisted at link-creation time.
   */
  txRef?: string
}): Promise<
  | { ok: true; status: "paid" | "failed" | "partial" | "pending"; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  const { orderNumber, txRef } = input
  if (!orderNumber) return { ok: false, error: "Missing order number." }

  const apiKey = process.env.STRYD_API_KEY
  if (!apiKey) return { ok: false, error: "Card payments are not configured." }

  try {
    const supabase = createAdminClient()
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, payment_status, stryd_tx_ref, stryd_status, total")
      .eq("order_number", orderNumber)
      .maybeSingle()

    if (orderErr) {
      console.error("[v0] verifyStrydPaymentAction lookup error:", orderErr.message)
      return { ok: false, error: "Could not look up your order." }
    }
    if (!order) return { ok: false, error: "Order not found." }

    if (order.payment_status === "paid") {
      return { ok: true, status: "paid", alreadyPaid: true }
    }

    const verifyRef = txRef || order.stryd_tx_ref
    if (!verifyRef) {
      console.warn(
        "[v0] verifyStrydPaymentAction: order has no stryd_tx_ref",
        { orderNumber, orderId: order.id },
      )
      return { ok: false, error: "Payment not linked to this order." }
    }

    const response = await fetch(
      `${STRYD_API_BASE}/api-checkout-status?tx_ref=${encodeURIComponent(verifyRef)}`,
      {
        method: "GET",
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(10_000),
      },
    )

    const rawBody = await response.text()
    let parsed: {
      tx_ref?: string
      status?: string
      message?: string
      amount?: number
      currency?: string
      fee_amount?: number
      net_amount?: number
      customer_email?: string
      paid_at?: string
    } | null = null
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null
    } catch {
      // fall through
    }

    if (!response.ok || !parsed) {
      console.error("[v0] Stryd verify failed", {
        status: response.status,
        verifyRef,
        body: rawBody.slice(0, 500),
      })
      // Same convention as Squadco: a transient gateway hiccup is
      // reported as pending so the UI can retry instead of failing.
      return { ok: true, status: "pending", alreadyPaid: false }
    }

    const mappedStatus = strydStatusToPaymentStatus(parsed.status)

    const update: Record<string, unknown> = {
      stryd_status: parsed.status ?? null,
      stryd_amount_paid: parsed.amount ?? null,
      stryd_fee_amount: parsed.fee_amount ?? null,
      stryd_net_amount: parsed.net_amount ?? null,
      stryd_paid_at: parsed.paid_at ?? null,
      stryd_updated_at: new Date().toISOString(),
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
      console.error("[v0] verifyStrydPaymentAction update error:", updateErr.message)
      return { ok: true, status: mappedStatus, alreadyPaid: false }
    }

    return { ok: true, status: mappedStatus, alreadyPaid: false }
  } catch (err) {
    console.error("[v0] verifyStrydPaymentAction threw:", err)
    return { ok: true, status: "pending", alreadyPaid: false }
  }
}
