"use client"

import { useState, useTransition } from "react"
import { Bell, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sendPaymentReminderAction } from "@/app/admin/actions/payment-reminders"

interface Props {
  orderId: string
  /** Read from the orders row. Button is hidden unless this is "pending". */
  paymentStatus: string
  /** Reminders sent so far — used to disable when we've hit the cap. */
  reminderCount: number
  /** When the last reminder went out (ISO string), for inline display. */
  lastSentAt: string | null
}

const MAX_REMINDERS = 3

/**
 * Compact reminder-send button for the admin order detail sidebar.
 *
 * Renders as a subtle outline button that briefly switches to a "Sent ✓"
 * confirmation after a successful send. Disables itself when:
 *  - payment is already paid / not pending, or
 *  - we've already hit MAX_REMINDERS for this order.
 *
 * Errors from the server action are surfaced inline below the button so
 * the operator doesn't have to dig into the network tab.
 */
export function PaymentReminderButton({
  orderId,
  paymentStatus,
  reminderCount,
  lastSentAt,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (paymentStatus !== "pending") return null

  const atCap = reminderCount >= MAX_REMINDERS
  const disabled = isPending || atCap

  const relative = lastSentAt ? formatRelative(lastSentAt) : null

  function onClick() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await sendPaymentReminderAction(orderId)
      if (result && "error" in result && result.error) {
        setError(result.error)
        return
      }
      if (result && "success" in result && result.success) {
        setMessage(`Reminder ${result.ordinal} of ${MAX_REMINDERS} sent.`)
      }
    })
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        variant="outline"
        size="sm"
        className="w-full justify-center"
      >
        {message ? (
          <>
            <Check className="w-4 h-4 mr-2" aria-hidden="true" />
            {message}
          </>
        ) : (
          <>
            <Bell className="w-4 h-4 mr-2" aria-hidden="true" />
            {isPending
              ? "Sending…"
              : atCap
                ? `Max reminders sent (${reminderCount}/${MAX_REMINDERS})`
                : reminderCount > 0
                  ? `Send payment reminder (${reminderCount}/${MAX_REMINDERS})`
                  : "Send payment reminder"}
          </>
        )}
      </Button>
      {relative && !message && (
        <p className="text-xs text-muted-foreground text-center">
          Last sent {relative}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}
