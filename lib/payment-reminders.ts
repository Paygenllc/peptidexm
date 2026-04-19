import "server-only"

/**
 * Payment-reminder cadence for orders placed but not paid. These numbers
 * were chosen to give the buyer a realistic chance to act without
 * becoming harassment:
 *
 *  - First nudge goes out ~24h after the order is placed. Plenty of
 *    shoppers place an order in the evening and pay the next day; we
 *    don't want to rush them overnight.
 *  - Second reminder goes ~3 days after the first. That's the typical
 *    "busy week" window.
 *  - Final notice goes ~3 days after that (so ~7 days post-order). Any
 *    orders still unpaid past 10 days can be cancelled manually; we do
 *    not auto-cancel here — that call stays with the operator.
 *
 * The numbers are exported so the cron route, the manual "Send reminder"
 * button, and any tests stay in sync.
 */
export const FIRST_PAYMENT_REMINDER_AFTER_MS = 24 * 60 * 60 * 1000 // 24h after order
export const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days between reminders
export const MAX_PAYMENT_REMINDERS = 3

export interface PendingOrderRow {
  id: string
  order_number: string
  email: string
  first_name: string | null
  last_name: string | null
  total: number | string
  status: string
  payment_status: string
  payment_reminder_count: number | null
  last_payment_reminder_sent_at: string | null
  created_at: string
}

/**
 * Compute the next reminder ordinal (1..3) for a pending order, or null
 * if it's not yet eligible / has maxed out. Centralized so the cron and
 * the manual-send pre-check agree on what "due" means.
 *
 * We treat `updated_at`-analog as the later of `created_at` and the last
 * reminder timestamp — whichever is more recent — because that's the
 * correct anchor for "how long has this been idle".
 */
export function nextPaymentReminderOrdinal(
  order: PendingOrderRow,
  now = Date.now(),
): 1 | 2 | 3 | null {
  if (order.payment_status !== "pending") return null
  if (order.status === "cancelled" || order.status === "refunded") return null

  const sent = order.payment_reminder_count ?? 0
  if (sent >= MAX_PAYMENT_REMINDERS) return null

  const lastTouch = new Date(
    order.last_payment_reminder_sent_at ?? order.created_at,
  ).getTime()
  const idleMs = now - lastTouch

  if (sent === 0 && idleMs >= FIRST_PAYMENT_REMINDER_AFTER_MS) return 1
  if (sent === 1 && idleMs >= REMINDER_INTERVAL_MS) return 2
  if (sent === 2 && idleMs >= REMINDER_INTERVAL_MS) return 3
  return null
}

/** Whole calendar days since the order was placed, used for email copy. */
export function daysSince(iso: string, now = Date.now()): number {
  const ms = now - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}
