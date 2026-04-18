"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateOrderAction } from "@/app/admin/actions/orders"
import { Loader2, BellRing, Link2 } from "lucide-react"

const STATUSES = ["processing", "confirmed", "shipped", "delivered", "cancelled", "refunded"] as const
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentPayment,
  currentTracking,
  currentCarrier,
  currentTrackingUrl,
  currentNotes,
}: {
  orderId: string
  currentStatus: string
  currentPayment: string
  currentTracking: string | null
  currentCarrier: string | null
  currentTrackingUrl: string | null
  currentNotes: string | null
}) {
  const [status, setStatus] = useState(currentStatus)
  const [paymentStatus, setPaymentStatus] = useState(currentPayment)
  const [tracking, setTracking] = useState(currentTracking ?? "")
  const [carrier, setCarrier] = useState(currentCarrier ?? "")
  const [trackingUrl, setTrackingUrl] = useState(currentTrackingUrl ?? "")
  const [notes, setNotes] = useState(currentNotes ?? "")
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Track whether something has been changed relative to the initial state —
  // a cheap "dirty" flag so we can keep the Save CTA clearly tied to an action.
  const dirty =
    status !== currentStatus ||
    paymentStatus !== currentPayment ||
    tracking !== (currentTracking ?? "") ||
    carrier !== (currentCarrier ?? "") ||
    trackingUrl !== (currentTrackingUrl ?? "") ||
    notes !== (currentNotes ?? "")

  function handleSubmit(formData: FormData) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await updateOrderAction(formData)
      if (result?.error) setError(result.error)
      else setMessage(notify ? "Order updated · customer notified" : "Order updated")
    })
  }

  return (
    <Card className="p-6 space-y-4 lg:sticky lg:top-8">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-foreground">Manage order</h2>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="orderId" value={orderId} />
        {/* Hidden when unchecked so the server-action treats the absence as "do not notify". */}
        {!notify && <input type="hidden" name="notify_customer" value="off" />}

        <div className="space-y-2">
          <Label htmlFor="status">Fulfillment status</Label>
          <Select name="status" value={status} onValueChange={setStatus}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_status">Payment status</Label>
          <Select name="payment_status" value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger id="payment_status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Tracking</div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tracking_carrier">Carrier</Label>
              <Input
                id="tracking_carrier"
                name="tracking_carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="UPS, FedEx, USPS…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking_number">Tracking number</Label>
              <Input
                id="tracking_number"
                name="tracking_number"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="1Z999AA10123456784"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking_url" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Tracking URL <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="tracking_url"
                name="tracking_url"
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://www.ups.com/track?..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">
            Note to customer <span className="text-xs text-muted-foreground font-normal">(included in email)</span>
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shipped with signature required. Please expect a delay over the weekend."
            rows={3}
          />
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/40 p-3">
          <Checkbox
            id="notify"
            checked={notify}
            onCheckedChange={(v) => setNotify(v === true)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <Label htmlFor="notify" className="flex items-center gap-1.5 cursor-pointer font-medium">
              <BellRing className="h-4 w-4" />
              Notify customer by email
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sends a tailored email for status, payment, tracking, or note changes. Uncheck to save silently.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-foreground rounded-md bg-green-50 border border-green-200 px-3 py-2">
            {message}
          </p>
        )}

        <Button type="submit" disabled={isPending || !dirty} className="w-full">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : dirty ? "Save changes" : "No changes"}
        </Button>
      </form>
    </Card>
  )
}
