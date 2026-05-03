"use client"

import { useActionState, useEffect, useRef } from "react"
import { Mail, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { subscribeToNewsletterAction } from "@/app/actions/subscribe"

type Props = {
  source?: string
  className?: string
  /** `dark` is for placement on a dark background (e.g. the footer). */
  tone?: "light" | "dark"
  /**
   * Optional success-state renderer. When provided, this is used in
   * place of the default "Thanks for subscribing" message so the
   * floating discount popover can show the coupon code returned by
   * the server action without having to scrape it back out of the DOM.
   */
  renderSuccess?: (info: { couponCode?: string }) => React.ReactNode
  /**
   * Fired exactly once when the server action transitions to success.
   * Lets parents react (e.g. set localStorage flags or close a panel)
   * without having to mirror their own MutationObserver.
   */
  onSuccess?: (info: { couponCode?: string }) => void
}

export function NewsletterForm({
  source = "footer",
  className = "",
  tone = "light",
  renderSuccess,
  onSuccess,
}: Props) {
  const [state, formAction, isPending] = useActionState(subscribeToNewsletterAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const successFiredRef = useRef(false)

  // Clear the input once the server confirms a successful subscription
  // and notify the parent. The ref guard prevents the side-effect from
  // firing twice if React re-runs the effect after a no-op state
  // update — important because `onSuccess` may set localStorage and
  // close a popover.
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      if (!successFiredRef.current) {
        successFiredRef.current = true
        onSuccess?.({ couponCode: state.couponCode })
      }
    }
  }, [state?.success, state?.couponCode, onSuccess])

  const isDark = tone === "dark"
  const iconClass = isDark
    ? "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-background/50 pointer-events-none"
    : "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
  const inputClass = isDark
    ? "pl-9 h-11 bg-background/10 border-background/20 text-background placeholder:text-background/40 focus-visible:border-background/40"
    : "pl-9 h-10"
  const successTextClass = isDark ? "text-background/70" : "text-muted-foreground"

  return (
    <form ref={formRef} action={formAction} className={`space-y-3 ${className}`} noValidate>
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Mail className={iconClass} aria-hidden="true" />
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@domain.com"
            aria-label="Email address"
            aria-invalid={state?.error ? true : undefined}
            className={inputClass}
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          variant={isDark ? "secondary" : "default"}
          className={isDark ? "h-11 w-full sm:w-auto gap-2" : "h-10 gap-2"}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Subscribing</span>
            </>
          ) : state?.success ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Subscribed</span>
            </>
          ) : (
            <span>Subscribe</span>
          )}
        </Button>
      </div>
      <div aria-live="polite" className="min-h-[1.25rem] text-xs">
        {state?.error && <span className="text-destructive">{state.error}</span>}
        {state?.success && (
          renderSuccess ? (
            renderSuccess({ couponCode: state.couponCode })
          ) : (
            <span className={successTextClass}>
              Thanks for subscribing — you&apos;ll hear from us soon.
            </span>
          )
        )}
      </div>
    </form>
  )
}
