import type { Metadata } from "next"
import { getFreeShippingEnabled } from "@/lib/shipping.server"
import {
  US_SHIPPING_FEE,
  INTL_SHIPPING_FEE,
  US_FREE_SHIPPING_THRESHOLD,
} from "@/lib/shipping"
import { FreeShippingToggle } from "./free-shipping-toggle"

export const metadata: Metadata = {
  title: "Shipping — PeptideXM Admin",
}

// Don't cache — this page's whole point is to reflect live toggle state.
export const dynamic = "force-dynamic"

export default async function ShippingSettingsPage() {
  const enabled = await getFreeShippingEnabled()

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl sm:text-3xl font-medium text-foreground">
          Shipping
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Control shipping fees charged at checkout. The free-shipping
          override applies to every order and every destination the moment
          it&apos;s flipped on — no deploy required.
        </p>
      </header>

      <FreeShippingToggle
        initialEnabled={enabled}
        usFee={US_SHIPPING_FEE}
        intlFee={INTL_SHIPPING_FEE}
        usFreeThreshold={US_FREE_SHIPPING_THRESHOLD}
      />
    </div>
  )
}
