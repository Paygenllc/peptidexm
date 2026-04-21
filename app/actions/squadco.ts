"use server"

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
 *   4. On successful payment, Squadco pings our webhook and redirects the
 *      customer back to `redirect_link` (our checkout success page).
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
