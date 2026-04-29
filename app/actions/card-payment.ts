"use server"

import { getActiveCardProcessor } from "@/lib/card-processor.server"
import {
  generateSquadcoPaymentLinkAction,
  persistSquadcoLinkToOrderAction,
  verifyCardPaymentAction as verifySquadcoPaymentAction,
} from "@/app/actions/squadco"
import {
  generateStrydPaymentLinkAction,
  persistStrydLinkToOrderAction,
  verifyStrydPaymentAction,
} from "@/app/actions/stryd"

/**
 * Card-payment dispatcher.
 *
 * The checkout page imports these three actions. Each one reads the
 * active processor from site_settings.card_processor and routes to
 * either Squadco or Stryd. This is the only file that knows about
 * "which provider is active" — the checkout page treats card payments
 * as a single abstract rail.
 *
 * Why not import both processors directly into the checkout page? Two
 * reasons:
 *
 *   1. The processor must be selectable from the admin without any
 *      code change. Reading site_settings at request time is what
 *      makes that possible — flipping the toggle is instant.
 *   2. The persist payload (Squadco's `hash` vs Stryd's `tx_ref`) is
 *      provider-specific. Centralizing the dispatch lets both shapes
 *      live in one place instead of leaking through the checkout's
 *      type system.
 *
 * The contract callers see is intentionally narrow: amount in cents
 * (cross-provider), email + name + redirect URL, and an opaque
 * `reference` that the checkout page round-trips back via the
 * `persistCardLinkToOrderAction` call.
 */

interface GenerateInput {
  orderNumber: string
  amountCents: number
  email: string
  firstName: string
  lastName: string
  redirectUrl: string
}

type GenerateResult =
  | { url: string; reference: string; processor: "squadco" | "stryd" }
  | { error: string }

export async function generateCardPaymentLinkAction(
  input: GenerateInput,
): Promise<GenerateResult> {
  const processor = await getActiveCardProcessor()

  if (processor === "stryd") {
    const result = await generateStrydPaymentLinkAction(input)
    if ("error" in result) return { error: result.error }
    return { url: result.url, reference: result.reference, processor: "stryd" }
  }

  // Default = squadco (matches DEFAULT_CARD_PROCESSOR).
  const result = await generateSquadcoPaymentLinkAction(input)
  if ("error" in result) return { error: result.error }
  return { url: result.url, reference: result.reference, processor: "squadco" }
}

/**
 * Persist the freshly-generated payment link onto the order row. The
 * caller passes the `processor` value returned by
 * `generateCardPaymentLinkAction`, which guarantees we write to the
 * right provider columns (squadco_* vs stryd_*) even if the admin
 * flips the active processor between link-creation and persistence.
 */
export async function persistCardLinkToOrderAction(input: {
  orderId: string
  reference: string
  checkoutUrl: string
  redirectUrl: string
  processor: "squadco" | "stryd"
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.processor === "stryd") {
    return persistStrydLinkToOrderAction({
      orderId: input.orderId,
      txRef: input.reference,
      checkoutUrl: input.checkoutUrl,
      redirectUrl: input.redirectUrl,
    })
  }
  return persistSquadcoLinkToOrderAction({
    orderId: input.orderId,
    hash: input.reference,
    checkoutUrl: input.checkoutUrl,
  })
}

/**
 * Verify a card payment against whichever processor handled it. We
 * decide which processor to query by inspecting which provider columns
 * are populated on the order row — NOT by reading the active
 * processor setting. That distinction matters: an order placed last
 * week via Squadco must keep verifying via Squadco, even after the
 * admin flips the toggle to Stryd.
 *
 * The order row is the source of truth for "which rail did this
 * order go down". The active-processor setting only affects newly
 * created links.
 */
export async function verifyCardPaymentAction(input: {
  orderNumber: string
  /**
   * Optional fresh reference from the redirect URL. Squadco and Stryd
   * both append their own tx_ref to the redirect; the checkout page
   * passes whichever it sees through verbatim.
   */
  transactionRef?: string
}): Promise<
  | { ok: true; status: "paid" | "failed" | "partial" | "pending"; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  // Quick lookup to decide which verifier to call. We read the same
  // row both verifiers will read, but only the provider-flag columns
  // — the actual reconciliation update happens inside the chosen
  // verifier so its idempotency rules apply unchanged.
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from("orders")
    .select("stryd_tx_ref, squadco_hash")
    .eq("order_number", input.orderNumber)
    .maybeSingle()

  if (order?.stryd_tx_ref) {
    return verifyStrydPaymentAction({
      orderNumber: input.orderNumber,
      txRef: input.transactionRef,
    })
  }

  // Default to Squadco. Covers both the "row has squadco_hash" case
  // and the "row has neither yet" race window where we just placed
  // the order but haven't persisted the link reference yet.
  return verifySquadcoPaymentAction({
    orderNumber: input.orderNumber,
    transactionRef: input.transactionRef,
  })
}
