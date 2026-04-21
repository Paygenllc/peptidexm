"use server"

import { getPaymentMethodToggles } from "@/lib/payment-methods.server"
import type { PaymentMethodToggles } from "@/lib/payment-methods"

/**
 * Public server action: returns the current enabled state of each
 * payment method. Called from the checkout page so the UI can hide
 * disabled rails. Fails open (all-enabled) on errors — see
 * `lib/payment-methods.ts`.
 */
export async function getEnabledPaymentMethodsAction(): Promise<PaymentMethodToggles> {
  return getPaymentMethodToggles()
}
