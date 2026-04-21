"use server"

/**
 * Squadco payment link generator.
 *
 * Squadco (habari.africa) is a payment processor that gives us card rails
 * without forcing us to become PCI-DSS compliant. We never see card numbers —
 * the customer is redirected to Squadco's hosted checkout URL with the order
 * amount pre-filled, and a webhook tells us when the payment captures.
 *
 * API reference:
 *   - Docs: https://docs.squadco.com/
 *   - Endpoint: POST /transaction/initiate
 *   - Response.data.checkout_url is where we redirect the customer.
 *
 * Sandbox vs live is auto-detected from the key prefix so a single integration
 * works across environments without any config juggling:
 *   - `sandbox_sk_*` / `sk_test_*`  → https://sandbox-api-d.squadco.com
 *   - `sk_*` / `sk_live_*` (anything else) → https://api-d.squadco.com
 *
 * Amounts are always passed in the smallest currency unit (cents for USD,
 * kobo for NGN). The `transaction_ref` is our idempotency handle — Squadco
 * deduplicates against it, so we can safely retry.
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
   * Currency code. Defaults to USD. Squadco supports NGN and USD on the
   * card rail; if you're on a plan that's restricted to NGN only, pass
   * 'NGN' here and convert on the server before calling.
   */
  currency?: "USD" | "NGN"
}

interface SquadcoInitiateResponse {
  status?: number
  success?: boolean
  message?: string
  data?: {
    checkout_url?: string
    authorization_url?: string
    transaction_ref?: string
  }
}

function resolveBaseUrl(secretKey: string): string {
  // Sandbox keys are prefixed `sandbox_` or `sk_test_` depending on when the
  // merchant account was provisioned. Everything else is treated as live.
  const isSandbox =
    secretKey.startsWith("sandbox_") || secretKey.startsWith("sk_test_")
  return isSandbox
    ? "https://sandbox-api-d.squadco.com"
    : "https://api-d.squadco.com"
}

export async function generateSquadcoPaymentLinkAction(
  input: Input,
): Promise<SquadcoResult> {
  const secretKey = process.env.SQUADCO_SECRET_KEY
  if (!secretKey) {
    console.error("[v0] SQUADCO_SECRET_KEY is not set")
    return { error: "Card payments are not configured. Contact support." }
  }

  const {
    orderNumber,
    amountCents,
    email,
    firstName,
    lastName,
    redirectUrl,
  } = input

  // Currency resolution: we let the operator pin the default with
  // SQUADCO_CURRENCY because Squadco accounts are provisioned per-currency
  // and sending USD to an NGN-only account comes back as a generic
  // "Transaction Failed" with no further detail. Explicit input wins,
  // env var is next, NGN is the final fallback (Squadco's house currency).
  const currency: "USD" | "NGN" =
    input.currency ??
    (process.env.SQUADCO_CURRENCY === "USD" ? "USD" : "NGN")

  // Amount sanity check — Squadco rejects non-integer or zero amounts with a
  // generic 400 that's hard to debug, so catch it locally with a clear error.
  const amount = Math.round(amountCents)
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error("[v0] Squadco: invalid amount", { amountCents })
    return { error: "Invalid order amount. Please refresh and try again." }
  }

  // Idempotency handle. Including a short random suffix protects us against
  // the (unlikely) case of the same order number being retried with a
  // different amount — Squadco will dedupe against the ref either way.
  const transactionRef = `pxm-${orderNumber}-${Date.now().toString(36)}`

  const baseUrl = resolveBaseUrl(secretKey)
  const endpoint = `${baseUrl}/transaction/initiate`

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        amount,
        email,
        currency,
        // `inline` returns a checkout_url we can redirect to.
        initiate_type: "inline",
        transaction_ref: transactionRef,
        callback_url: redirectUrl,
        // Intentionally NOT restricting payment_channels. Doing so causes
        // Squadco to return a generic "Transaction Failed" whenever the
        // listed channel isn't enabled on the merchant account (e.g. card
        // in sandbox). The Squadco-hosted page shows only the methods the
        // merchant actually has enabled, so leaving this off is both
        // safer and matches the customer's real options.
        customer_name: `${firstName} ${lastName}`.trim() || email,
        metadata: {
          order_number: orderNumber,
          first_name: firstName,
          last_name: lastName,
          source: "peptidexm-checkout",
          created_at: new Date().toISOString(),
        },
      }),
    })

    const rawBody = await response.text()
    let parsed: SquadcoInitiateResponse | null = null
    try {
      parsed = rawBody ? (JSON.parse(rawBody) as SquadcoInitiateResponse) : null
    } catch {
      // Fall through — we'll log the raw body below.
    }

    // Squadco returns HTTP 200 with `success: false` for business-logic
    // failures (disabled channel, currency mismatch, amount too small,
    // etc.) so we have to inspect both the HTTP status and the body.
    if (!response.ok || !parsed?.success) {
      console.error("[v0] Squadco initiate failed", {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        environment: baseUrl.includes("sandbox") ? "sandbox" : "live",
        currency,
        amount,
        // Log the full parsed body so we can see the exact Squadco payload —
        // this is what tells us whether it's a currency, channel, or key issue.
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

      // Squadco's generic "Transaction Failed" almost always means either
      // a currency mismatch or an amount below their minimum. Surface a
      // more actionable hint so the operator knows where to look.
      if (providerMessage?.toLowerCase() === "transaction failed") {
        return {
          error:
            "Card payment could not be initiated. Your Squadco account may not support this currency or amount. Please use Zelle or USDT, or contact support.",
        }
      }

      return {
        error: providerMessage
          ? `Payment provider: ${providerMessage}`
          : `Payment service error (${response.status}). Please try again or contact support.`,
      }
    }

    const checkoutUrl =
      parsed.data?.checkout_url || parsed.data?.authorization_url
    if (!checkoutUrl) {
      console.error("[v0] Squadco response missing checkout_url", parsed)
      return { error: "Payment link generation failed. Please try again." }
    }

    return { url: checkoutUrl, reference: transactionRef }
  } catch (err) {
    console.error("[v0] Squadco initiate threw", err)
    return {
      error:
        "Could not reach the payment service. Please check your connection and try again.",
    }
  }
}
