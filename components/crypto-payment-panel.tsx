"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bitcoin, ExternalLink, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createCryptoInvoiceAction } from "@/app/actions/crypto"

interface Props {
  orderId: string
  orderNumber: string
  total: number
  customerEmail: string
}

/**
 * Crypto payment success panel.
 *
 * When this panel mounts, it asks the server to create (or reuse) a hosted
 * NOWPayments invoice for this order. We show the hosted-page link as a
 * prominent CTA — clicking it opens the invoice in a new tab where the
 * shopper picks a coin, scans the QR, and pays.
 *
 * If the shopper closes the tab we keep the link here so they can resume;
 * the invoice URL is persisted on the order row.
 */
export function CryptoPaymentPanel({
  orderId,
  orderNumber,
  total,
  customerEmail,
}: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const startedRef = useRef(false)

  useEffect(() => {
    // Guard against React StrictMode's double-invoke in dev, and against
    // re-renders caused by prop changes.
    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false
    ;(async () => {
      try {
        const res = await createCryptoInvoiceAction({ orderId })
        if (cancelled) return
        if (res?.error) {
          setError(res.error)
        } else if (res?.url) {
          setUrl(res.url)
        } else {
          setError("Could not generate crypto invoice. Please contact support.")
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong. Please try again.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orderId])

  return (
    <div className="text-left">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-accent/10 mb-3">
          <Bitcoin className="h-6 w-6 text-accent" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-medium text-balance">
          Pay with crypto
        </h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          You&apos;ll be redirected to our secure payment partner to complete the
          payment in USDT, USDC, or DAI.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Order</span>
          <span className="font-mono text-sm font-medium text-foreground break-all">
            {orderNumber}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Amount due</span>
          <span className="font-serif text-xl font-semibold text-foreground tabular-nums">
            ${total.toFixed(2)}
            <span className="ml-1 text-sm text-muted-foreground font-sans">USD</span>
          </span>
        </div>

        <div className="border-t border-border pt-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Preparing your secure payment page…
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {!loading && url && (
            <div className="space-y-3">
              <Button asChild size="lg" className="h-12 w-full">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Pay with crypto
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Opens in a new tab. You can return here and click the button
                again if you need to resume — we&apos;ll reuse the same invoice.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:p-5 mb-6">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            Payments are processed by NOWPayments. Once the network confirms
            your transfer, we&apos;ll automatically mark the order paid and email{" "}
            <span className="font-medium text-foreground break-all">{customerEmail}</span>
            {" "}when it ships. No further action needed.
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild variant="outline" className="h-11">
          <Link href="/">Return to Store</Link>
        </Button>
        <Button asChild className="h-11">
          <Link href="/account">View My Orders</Link>
        </Button>
      </div>
    </div>
  )
}
