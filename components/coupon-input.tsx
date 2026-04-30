"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tag, X, Loader2 } from "lucide-react"
import {
  couponErrorMessage,
  formatMoney,
  type ValidatedCoupon,
} from "@/lib/coupons"

interface CouponInputProps {
  /** Subtotal *before* shipping/tax — the only thing coupons discount. */
  subtotal: number
  /** Customer email if known (for per-customer cap + email-locked codes). */
  email?: string
  /** The currently applied coupon, or null. Lifted into the parent. */
  applied: ValidatedCoupon | null
  onApplied: (c: ValidatedCoupon) => void
  onRemoved: () => void
  /** Compact = order-summary card; full = standalone block. */
  compact?: boolean
}

/**
 * Self-contained coupon entry block. Handles its own input state +
 * validation request, then bubbles the resolved coupon up to the
 * parent so the parent can pass `couponCode` to placeOrderAction.
 *
 * The component never trusts its own `amountOff` — it's just for
 * rendering. Authoritative discount math runs server-side at
 * place-order time via the same `validate_coupon` RPC.
 */
export function CouponInput({
  subtotal,
  email,
  applied,
  onApplied,
  onRemoved,
  compact = false,
}: CouponInputProps) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    const trimmed = code.trim()
    if (!trimmed) {
      setError("Enter a coupon code.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, email, subtotal }),
      })
      const json = (await res.json()) as
        | { ok: true; coupon: ValidatedCoupon }
        | { ok: false; error: string }
      if (!json.ok) {
        setError(json.error)
        return
      }
      onApplied(json.coupon)
      setCode("")
    } catch (err) {
      setError(couponErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Applied state: render a removable pill instead of the input.
  if (applied) {
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 ${
          compact ? "px-3 py-2" : "px-4 py-3"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-4 h-4 text-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {applied.code}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              −{formatMoney(applied.amountOff)} off
              {applied.type === "percent" ? ` (${applied.value}% off subtotal)` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemoved}
          className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded transition-colors"
          aria-label={`Remove coupon ${applied.code}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {!compact && (
        <Label htmlFor="coupon-code" className="text-sm">
          Have a coupon code?
        </Label>
      )}
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void apply()
            }
          }}
          placeholder={compact ? "Coupon code" : "Enter your code"}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono uppercase tracking-wide"
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "coupon-error" : undefined}
        />
        <Button
          type="button"
          variant="outline"
          onClick={apply}
          disabled={busy || !code.trim()}
          className="shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && (
        <p id="coupon-error" className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
