"use client"

import { useState, useTransition } from "react"
import { CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ZelleLogo, TetherLogo } from "@/components/payment-logos"
import { setPaymentMethodEnabledAction } from "@/app/admin/actions/settings"
import type {
  PaymentMethodKey,
  PaymentMethodToggles,
} from "@/lib/payment-methods"

type MethodDef = {
  key: PaymentMethodKey
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}

// Order here is the order shown on checkout when all are enabled.
// Keep it aligned with `app/checkout/page.tsx`'s rendering order.
const METHODS: MethodDef[] = [
  {
    key: "card",
    label: "Credit / Debit card",
    description:
      "PCI-compliant hosted payment links. Customers enter card data on our payment partner's page — we never see or store it.",
    Icon: CreditCard,
  },
  {
    key: "zelle",
    label: "Zelle",
    description:
      "Customer sends payment from their bank's Zelle app. They receive instructions by email; you confirm receipt manually.",
    Icon: ZelleLogo,
  },
  {
    key: "crypto",
    label: "USDT (TRC-20)",
    description:
      "Tether on the TRON network via our crypto payment partner. Orders are auto-marked paid once the network confirms.",
    Icon: TetherLogo,
  },
]

export function PaymentToggles({
  initialToggles,
}: {
  initialToggles: PaymentMethodToggles
}) {
  // Optimistic local state so the toggle feels instant. If the server
  // call fails we roll back and surface the error in a toast-style banner.
  const [toggles, setToggles] = useState<PaymentMethodToggles>(initialToggles)
  const [pendingKey, setPendingKey] = useState<PaymentMethodKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const allOff = !toggles.card && !toggles.zelle && !toggles.crypto

  const handleToggle = (method: PaymentMethodKey, nextValue: boolean) => {
    // Optimistic update
    const previous = toggles
    setToggles({ ...previous, [method]: nextValue })
    setPendingKey(method)
    setError(null)

    startTransition(async () => {
      const result = await setPaymentMethodEnabledAction({
        method,
        enabled: nextValue,
      })
      if (!result.ok) {
        // Roll back the optimistic flip.
        setToggles(previous)
        setError(result.error || "Could not update this setting.")
      }
      setPendingKey(null)
    })
  }

  return (
    <div className="space-y-4">
      {allOff && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border-2 border-amber-400/50 bg-amber-50 p-4 text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">
              All payment methods are currently disabled.
            </p>
            <p className="text-sm mt-1 leading-relaxed">
              Customers cannot place orders until at least one method is
              re-enabled. The checkout page is showing a &ldquo;payments
              unavailable&rdquo; message.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border-2 border-red-400/50 bg-red-50 p-4 text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">Could not save change</p>
            <p className="text-sm mt-1 leading-relaxed break-words">{error}</p>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {METHODS.map(({ key, label, description, Icon }) => {
          const isEnabled = toggles[key]
          const isRowPending = isPending && pendingKey === key
          return (
            <li
              key={key}
              className="flex items-start gap-4 rounded-lg border-2 border-border bg-card p-4 sm:p-5"
            >
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                  isEnabled
                    ? "bg-accent/10 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
                aria-hidden
              >
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{label}</p>
                  {isEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 uppercase tracking-wider">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Live
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                      Off
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {description}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 pt-0.5">
                <Switch
                  checked={isEnabled}
                  disabled={isRowPending}
                  onCheckedChange={(v) => handleToggle(key, v)}
                  aria-label={`${label}: ${isEnabled ? "enabled" : "disabled"}`}
                />
                {isRowPending && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Saving…
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
