/**
 * Thin REST wrapper around PayPal's Orders v2 API.
 *
 * Why a bespoke client (no SDK):
 *   - The official @paypal/checkout-server-sdk package is deprecated
 *     and the recommended path is direct REST, which is what this
 *     file does. It's a small surface (token, create, capture) and
 *     not worth pulling in an unmaintained dependency for.
 *   - Keeps the checkout bundle lean: this only runs server-side.
 *
 * Environment targeting:
 *   - Production (api-m.paypal.com) is the default per the project's
 *     chosen deployment model.
 *   - If `PAYPAL_ENV=sandbox` is set, we target the sandbox host
 *     instead. This gives us a knob for later switching without code
 *     changes if that preference ever flips.
 */

const PAYPAL_LIVE_HOST = "https://api-m.paypal.com"
const PAYPAL_SANDBOX_HOST = "https://api-m.sandbox.paypal.com"

export function getPaypalHost(): string {
  // Explicit opt-in to sandbox — everything else goes to live.
  return process.env.PAYPAL_ENV === "sandbox"
    ? PAYPAL_SANDBOX_HOST
    : PAYPAL_LIVE_HOST
}

/**
 * Minimal in-memory access token cache. PayPal tokens are typically
 * valid for ~9 hours. Caching per-instance avoids hammering the
 * auth endpoint on every checkout. We refresh ~60s before expiry so
 * concurrent requests don't race a near-expired token.
 */
type CachedToken = { accessToken: string; expiresAt: number }
let cachedToken: CachedToken | null = null

/**
 * Exchanges the client_id/secret for a short-lived access token via
 * PayPal's client_credentials OAuth flow. Throws on misconfiguration
 * or auth failure — the caller should catch and surface a generic
 * "payment temporarily unavailable" message to the shopper.
 */
export async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PayPal is not configured (missing client id/secret).")
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const response = await fetch(`${getPaypalHost()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    // Short timeout — auth requests shouldn't hang the checkout.
    signal: AbortSignal.timeout(10_000),
  })

  const body = (await response.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  } | null

  if (!response.ok || !body?.access_token) {
    console.error("[v0] PayPal token exchange failed", {
      status: response.status,
      body,
    })
    throw new Error("Could not authenticate with PayPal.")
  }

  cachedToken = {
    accessToken: body.access_token,
    // expires_in is in seconds; convert to a ms epoch deadline.
    expiresAt: now + (body.expires_in ?? 3600) * 1_000,
  }
  return body.access_token
}

/**
 * Minimal shape of the PayPal `create order` response we care about.
 * PayPal returns many more fields (links, payment_source, etc.), but
 * downstream code only needs the id (for capture) and the approve URL
 * (for the redirect). We look up the approve URL from the `links`
 * array because PayPal's docs mark its position as unstable.
 */
export type PaypalCreateOrderResponse = {
  id: string
  status: string
  approveUrl: string
}

/**
 * Creates a PayPal order and returns the id + approve URL.
 *
 * Amount is passed as cents (our internal convention) and formatted
 * as a fixed-2-decimal string for PayPal, which requires currency
 * values as strings to avoid float precision loss.
 */
export async function createPaypalOrder(input: {
  amountCents: number
  currency: string
  orderNumber: string
  returnUrl: string
  cancelUrl: string
}): Promise<PaypalCreateOrderResponse> {
  const { amountCents, currency, orderNumber, returnUrl, cancelUrl } = input
  const token = await getPaypalAccessToken()

  const amountValue = (amountCents / 100).toFixed(2)

  const response = await fetch(`${getPaypalHost()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // PayPal recommends a PayPal-Request-Id per order to make create
      // calls idempotent. We use our own order_number so a retry with
      // the same number returns the same PayPal order instead of
      // duplicating.
      "PayPal-Request-Id": orderNumber,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderNumber,
          amount: { currency_code: currency, value: amountValue },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            // Keep the approval page focused — no PayPal address
            // collection (we already have the shipping address from
            // our own form) and no "guest checkout" pitch.
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  const body = (await response.json().catch(() => null)) as {
    id?: string
    status?: string
    links?: Array<{ href: string; rel: string; method?: string }>
    message?: string
    details?: unknown
  } | null

  if (!response.ok || !body?.id) {
    console.error("[v0] PayPal create order failed", {
      status: response.status,
      body,
    })
    throw new Error(body?.message || "Could not start PayPal checkout.")
  }

  // Approve URL lives under rel === "payer-action" (new flow) or
  // rel === "approve" (legacy). Accept either so we don't break when
  // PayPal rolls this out region-by-region.
  const approveLink =
    body.links?.find((l) => l.rel === "payer-action") ||
    body.links?.find((l) => l.rel === "approve")
  if (!approveLink?.href) {
    console.error("[v0] PayPal create order missing approve link", body)
    throw new Error("Could not start PayPal checkout.")
  }

  return {
    id: body.id,
    status: body.status ?? "CREATED",
    approveUrl: approveLink.href,
  }
}

/**
 * Shape we surface to callers after capturing. Mirrors just the
 * fields the return-route handler needs to update the orders row.
 */
export type PaypalCaptureResult = {
  orderId: string
  status: string
  captureId: string | null
  amountCents: number | null
  currency: string | null
  paid: boolean
}

/**
 * Captures a previously-created PayPal order. Idempotent on PayPal's
 * side if the order is already captured — we still parse the
 * response so the caller can update `paypal_status` appropriately.
 */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalCaptureResult> {
  const token = await getPaypalAccessToken()

  const response = await fetch(
    `${getPaypalHost()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Using the PayPal order id as the idempotency key so repeat
        // captures (double-clicks, refresh on return page) don't
        // double-charge. PayPal's own idempotency semantics handle
        // this on their end as well; the header is belt-and-braces.
        "PayPal-Request-Id": `capture-${paypalOrderId}`,
      },
      signal: AbortSignal.timeout(20_000),
    },
  )

  const body = (await response.json().catch(() => null)) as {
    id?: string
    status?: string
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id?: string
          status?: string
          amount?: { currency_code?: string; value?: string }
        }>
      }
    }>
    message?: string
  } | null

  // Some "422 ORDER_ALREADY_CAPTURED" responses are actually wins
  // (idempotent re-capture). Treat them as successful if the body
  // confirms status COMPLETED.
  if (!body?.id) {
    console.error("[v0] PayPal capture failed", {
      status: response.status,
      body,
    })
    throw new Error(body?.message || "Could not finalize PayPal payment.")
  }

  const capture = body.purchase_units?.[0]?.payments?.captures?.[0]
  const amountStr = capture?.amount?.value
  const amountCents = amountStr
    ? Math.round(parseFloat(amountStr) * 100)
    : null

  const status = capture?.status || body.status || "UNKNOWN"
  // Treat COMPLETED as paid. Anything else (PENDING, DECLINED, FAILED)
  // leaves the order unpaid for the UI to report.
  const paid = status === "COMPLETED"

  return {
    orderId: body.id,
    status,
    captureId: capture?.id ?? null,
    amountCents,
    currency: capture?.amount?.currency_code ?? null,
    paid,
  }
}
