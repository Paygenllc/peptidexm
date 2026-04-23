"use server"

import { getPaymentMethodToggles } from "@/lib/payment-methods.server"
import type { PaymentMethodToggles } from "@/lib/payment-methods"
import { getFreeShippingEnabled } from "@/lib/shipping.server"

/**
 * Public server action: returns the current enabled state of each
 * payment method. Called from the checkout page so the UI can hide
 * disabled rails. Fails open (all-enabled) on errors — see
 * `lib/payment-methods.ts`.
 */
export async function getEnabledPaymentMethodsAction(): Promise<PaymentMethodToggles> {
  return getPaymentMethodToggles()
}

/**
 * Public server action: returns `true` when the admin has flipped on
 * the site-wide free-shipping override. Called from the checkout page
 * and the cart sidebar so the UI can swap the "+$X shipping" line for
 * "FREE" without waiting on a page refresh. Fails closed (false) on
 * errors — see `lib/shipping.server.ts` for the full rationale.
 */
export async function getFreeShippingEnabledAction(): Promise<boolean> {
  return getFreeShippingEnabled()
}
