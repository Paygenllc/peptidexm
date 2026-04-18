"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Check, Copy, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CONTACT_EMAIL } from "@/lib/contact"
import { submitPaymentAction } from "@/app/actions/submit-payment"

interface Props {
  orderNumber: string
  total: number
  customerEmail: string
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore — not all browsers allow clipboard writes
    }
  }
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1.5 flex items-stretch gap-2">
        <div className="flex-1 rounded-md border border-border bg-background px-3 py-2.5 font-mono text-sm break-all">
          {value}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="h-auto px-3 shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export function ZellePaymentPanel({ orderNumber, total, customerEmail }: Props) {
  const [reference, setReference] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!reference.trim()) {
      setError("Enter your Zelle confirmation code")
      return
    }
    setIsSubmitting(true)
    try {
      const result = await submitPaymentAction({
        orderNumber,
        reference: reference.trim(),
        email: customerEmail,
      })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="text-left">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-accent/10 mb-3">
          <Mail className="h-6 w-6 text-accent" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-medium text-balance">Send payment via Zelle</h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Open your bank&apos;s Zelle, send the exact amount to the email below, and use your order number as the memo.
        </p>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 mb-5">
        <CopyField label="Send to (Zelle email)" value={CONTACT_EMAIL} />
        <CopyField label="Amount" value={`$${total.toFixed(2)}`} />
        <CopyField label="Memo / Note" value={orderNumber} />
      </div>

      {/* Warning */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 mb-6">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-destructive mb-1">Do not include product names</p>
            <p className="text-destructive/90 leading-relaxed">
              Use <span className="font-mono">{orderNumber}</span> as the <strong>only</strong> text in the Zelle memo.
              Do <strong>not</strong> include product names, the word &ldquo;peptide&rdquo;, or any research terms.
              Payments that mention products will be <strong>cancelled and refunded</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Submit reference */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h3 className="font-medium text-foreground mb-1">After you send the Zelle</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Paste the Zelle confirmation code (from your banking app) so we can match and fulfill your order faster.
        </p>

        {submitted ? (
          <div className="rounded-lg bg-accent/10 border border-accent/20 p-4 text-sm">
            <p className="font-medium text-foreground mb-1">Thanks — we&apos;ve got your reference.</p>
            <p className="text-muted-foreground">
              We&apos;ll verify the Zelle transfer and email{" "}
              <span className="font-medium text-foreground break-all">{customerEmail}</span> once your order ships.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="zelle-reference" className="sr-only">
                Zelle confirmation code
              </Label>
              <Input
                id="zelle-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Zelle confirmation code"
                autoComplete="off"
                inputMode="text"
                maxLength={120}
                className="h-12"
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit payment reference"}
            </Button>
          </form>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
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
