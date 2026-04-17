"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateOrderAction } from "@/app/admin/actions/orders"
import { Loader2 } from "lucide-react"

const STATUSES = ["processing", "confirmed", "shipped", "delivered", "cancelled", "refunded"] as const
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentPayment,
  currentTracking,
  currentCarrier,
  currentNotes,
}: {
  orderId: string
  currentStatus: string
  currentPayment: string
  currentTracking: string | null
  currentCarrier: string | null
  currentNotes: string | null
}) {
  const [status, setStatus] = useState(currentStatus)
  const [paymentStatus, setPaymentStatus] = useState(currentPayment)
  const [tracking, setTracking] = useState(currentTracking ?? "")
  const [carrier, setCarrier] = useState(currentCarrier ?? "")
  const [notes, setNotes] = useState(currentNotes ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await updateOrderAction(formData)
      if (result?.error) setError(result.error)
      else setMessage("Order updated successfully")
    })
  }

  return (
    <Card className="p-6 space-y-4 sticky top-8">
      <h2 className="font-semibold text-foreground">Manage Order</h2>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="orderId" value={orderId} />

        <div className="space-y-2">
          <Label htmlFor="status">Fulfillment Status</Label>
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
          <Label htmlFor="payment_status">Payment Status</Label>
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

        <div className="space-y-2">
          <Label htmlFor="tracking_carrier">Carrier</Label>
          <Input
            id="tracking_carrier"
            name="tracking_carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="UPS, FedEx, USPS..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tracking_number">Tracking Number</Label>
          <Input
            id="tracking_number"
            name="tracking_number"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="1Z999AA10123456784"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Internal Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Not visible to customer"
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-primary">{message}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
        </Button>
      </form>
    </Card>
  )
}
