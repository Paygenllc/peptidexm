"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, AlertTriangle, Zap } from "lucide-react"
import { setCardProcessorAction } from "@/app/admin/actions/settings"
import type { CardProcessor } from "@/lib/card-processor.server"

interface ProcessorOption {
  key: CardProcessor
  label: string
  /**
   * Short summary of what makes this processor distinct. Surfaced as
   * helper text under the option's name so the operator doesn't have
   * to remember which one supports what.
   */
  description: string
  /** Hint to the operator about what env vars must be set in Vercel. */
  envHint: string
}

const PROCESSORS: ProcessorOption[] = [
  {
    key: "squadco",
    label: "Squadco",
    description:
      "GTBank's Squad payment links. Supports cards (Verve, Visa, Mastercard) and bank transfers.",
    envHint: "Requires SQUADCO_SECRET_KEY",
  },
  {
    key: "stryd",
    label: "Stryd Pay",
    description:
      "USD-only hosted checkout with a documented $10,000 per-transaction ceiling. Lower fees on smaller charges.",
    envHint: "Requires STRYD_API_KEY",
  },
]

export function CardProcessorSelector({
  initialProcessor,
  /**
   * Boolean map keyed by processor name indicating whether each
   * processor's env vars are present at server-render time. We use it
   * to surface a "missing env vars" warning next to any option that
   * the operator can't actually use yet — it doesn't BLOCK selection
   * (the deploy that fixed the env var may not have rolled to this
   * region's prerender), just tells them what's wrong.
   */
  envStatus,
}: {
  initialProcessor: CardProcessor
  envStatus: Record<CardProcessor, boolean>
}) {
  // Optimistic local state — same pattern as PaymentToggles. The
  // server action either confirms our optimistic flip or we roll back.
  const [active, setActive] = useState<CardProcessor>(initialProcessor)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handlePick = (next: CardProcessor) => {
    if (next === active || isPending) return
    const previous = active
    setActive(next)
    setError(null)

    startTransition(async () => {
      const result = await setCardProcessorAction({ processor: next })
      if (!result.ok) {
        setActive(previous)
        setError(result.error || "Could not switch processor.")
      }
    })
  }

  return (
    <section
      aria-labelledby="processor-heading"
      className="rounded-lg border-2 border-border bg-card p-5 sm:p-6 space-y-4"
    >
      <div className="space-y-1">
        <h2
          id="processor-heading"
          className="font-medium text-foreground flex items-center gap-2"
        >
          <Zap className="h-4 w-4 text-accent" aria-hidden />
          Card processor
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Only one processor handles new card payments at a time. Switching
          takes effect immediately — orders already in flight keep verifying
          against the processor that issued their link.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border-2 border-red-400/50 bg-red-50 p-3 text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-sm leading-relaxed">{error}</p>
        </div>
      )}

      <div
        role="radiogroup"
        aria-labelledby="processor-heading"
        className="grid gap-3 sm:grid-cols-2"
      >
        {PROCESSORS.map((p) => {
          const isActive = active === p.key
          const envOk = envStatus[p.key]
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={isPending}
              onClick={() => handlePick(p.key)}
              className={`flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-colors disabled:opacity-60 ${
                isActive
                  ? "border-accent bg-accent/5"
                  : "border-border bg-card hover:border-accent/50 hover:bg-accent/5"
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium text-foreground">{p.label}</span>
                {isActive ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 uppercase tracking-wider">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Active
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                    Standby
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {p.description}
              </p>
              <p
                className={`text-[11px] uppercase tracking-wider ${
                  envOk ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {envOk ? "Configured" : `Missing env: ${p.envHint}`}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
