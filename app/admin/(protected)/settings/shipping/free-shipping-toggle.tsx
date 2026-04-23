"use client"

import { useState, useTransition } from "react"
import { Truck, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { setFreeShippingEnabledAction } from "@/app/admin/actions/settings"

interface FreeShippingToggleProps {
  initialEnabled: boolean
  usFee: number
  intlFee: number
  usFreeThreshold: number
}

/**
 * Admin control for the site-wide free-shipping override.
 *
 * Flipping this switch writes to `site_settings.shipping_free_all_enabled`
 * and immediately affects the price the next shopper sees at checkout.
 * The UX pattern mirrors the Payment methods toggle list on the
 * sibling page: optimistic local flip, server-action write, rollback
 * on failure, small inline status dots so the admin always knows
 * whether the server has caught up with the UI.
 */
export function FreeShippingToggle({
  initialEnabled,
  usFee,
  intlFee,
  usFreeThreshold,
}: FreeShippingToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: v % 1 === 0 ? 0 : 2,
    }).format(v)

  const handleToggle = (nextValue: boolean) => {
    // Optimistic flip so the switch animation feels instant. We roll
    // back to the previous value if the server write fails.
    const previous = enabled
    setEnabled(nextValue)
    setError(null)

    startTransition(async () => {
      const result = await setFreeShippingEnabledAction({
        enabled: nextValue,
      })
      if (!result.ok) {
        setEnabled(previous)
        setError(result.error || "Could not update this setting.")
      }
    })
  }

  return (
    <div className="space-y-4">
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

      {/* The primary control — styled to match the Payment methods rows
       * so the two settings pages feel like one family. */}
      <div className="flex items-start gap-4 rounded-lg border-2 border-border bg-card p-4 sm:p-5">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
            enabled
              ? "bg-accent/10 text-accent"
              : "bg-muted text-muted-foreground"
          }`}
          aria-hidden
        >
          <Truck className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground">
              Free shipping on all orders
            </p>
            {enabled ? (
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
            When on, every order ships free regardless of destination or
            cart subtotal. Overrides the normal US/international shipping
            rates shown below. Use for site-wide promotions.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 pt-0.5">
          <Switch
            checked={enabled}
            disabled={isPending}
            onCheckedChange={handleToggle}
            aria-label={`Free shipping override: ${enabled ? "enabled" : "disabled"}`}
          />
          {isPending && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saving…
            </span>
          )}
        </div>
      </div>

      {/* Reference card showing the normal shipping rules so the admin
       * can see what the override is replacing. Rendered muted when
       * the override is ON since those rules don't apply right now. */}
      <div
        className={`rounded-lg border-2 border-border bg-card p-4 sm:p-5 transition-opacity ${
          enabled ? "opacity-60" : ""
        }`}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Standard shipping {enabled ? "(paused)" : "(active)"}
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">US orders</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatCurrency(usFee)}{" "}
              <span className="text-muted-foreground font-normal">
                (free over {formatCurrency(usFreeThreshold)})
              </span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">International orders</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatCurrency(intlFee)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          To change these rates, edit <code className="rounded bg-muted px-1 py-0.5 text-[11px]">lib/shipping.ts</code>.
        </p>
      </div>
    </div>
  )
}
