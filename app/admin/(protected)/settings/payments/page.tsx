import type { Metadata } from "next"
import { getPaymentMethodToggles } from "@/lib/payment-methods.server"
import { PaymentToggles } from "./payment-toggles"

export const metadata: Metadata = {
  title: "Payment methods — PeptideXM Admin",
}

// Don't cache — this page's whole point is to reflect live toggle state.
export const dynamic = "force-dynamic"

export default async function PaymentSettingsPage() {
  const toggles = await getPaymentMethodToggles()

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl sm:text-3xl font-medium text-foreground">
          Payment methods
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Toggle which checkout rails are available to customers. Disabled
          methods are hidden from the checkout page immediately — no deploy
          required.
        </p>
      </header>

      <PaymentToggles initialToggles={toggles} />
    </div>
  )
}
