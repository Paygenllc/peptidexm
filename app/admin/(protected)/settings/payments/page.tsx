import type { Metadata } from "next"
import { getPaymentMethodToggles } from "@/lib/payment-methods.server"
import { getActiveCardProcessor } from "@/lib/card-processor.server"
import { PaymentToggles } from "./payment-toggles"
import { CardProcessorSelector } from "./card-processor-selector"

export const metadata: Metadata = {
  title: "Payment methods — PeptideXM Admin",
}

// Don't cache — this page's whole point is to reflect live toggle state.
export const dynamic = "force-dynamic"

export default async function PaymentSettingsPage() {
  // Two parallel reads: which methods are enabled, and which card
  // processor is the active one. Both come from site_settings.
  const [toggles, activeProcessor] = await Promise.all([
    getPaymentMethodToggles(),
    getActiveCardProcessor(),
  ])

  // Render-time env presence check. We only care whether the API key
  // exists — never expose the value itself. The selector uses this to
  // warn the operator if they pick a processor that hasn't been
  // configured yet, so they don't push customers down a broken rail.
  const envStatus = {
    squadco: Boolean(process.env.SQUADCO_SECRET_KEY),
    stryd: Boolean(process.env.STRYD_API_KEY),
  } as const

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

      <CardProcessorSelector
        initialProcessor={activeProcessor}
        envStatus={envStatus}
      />

      <PaymentToggles initialToggles={toggles} />
    </div>
  )
}
