import "server-only"
import crypto from "node:crypto"

/**
 * Minimum time a cart has to sit untouched before we consider sending the
 * first reminder. Shorter than this and we risk emailing people who are
 * mid-session (they typed their email, got up for coffee). 30 minutes is a
 * common ecommerce default and lines up with the Vercel cron cadence.
 */
export const FIRST_REMINDER_AFTER_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Second (and final) reminder window. We send it ~24h after the first one,
 * then stop — sending more than two becomes harassment and starts hurting
 * deliverability. `reminder_count` in the DB caps the sequence at 2.
 */
export const SECOND_REMINDER_AFTER_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Max messages per cart, ever. If this changes, update the cron selector
 * and the manual-send guardrail in lockstep.
 */
export const MAX_REMINDERS = 2

/**
 * Opaque, URL-safe single-use-ish recovery token. 32 bytes of entropy is
 * plenty — these never get printed in any server log, and the only place
 * they appear is in the email link + the URL a customer clicks.
 */
export function generateRecoveryToken() {
  return crypto.randomBytes(32).toString("base64url")
}

/**
 * Canonical site origin for building external links (email CTAs, cron
 * logs). Falls back to the Vercel-provided URL in preview deployments
 * and finally to localhost for local dev.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`
  return "http://localhost:3000"
}

export interface AbandonedCartItemSnapshot {
  /** Product id from the storefront catalog (number). */
  id: number
  name: string
  variant: string
  price: number
  quantity: number
  image: string
}

export interface AbandonedCartRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  user_id: string | null
  token: string
  items: AbandonedCartItemSnapshot[]
  subtotal: number
  reminder_count: number
  last_reminder_sent_at: string | null
  recovered_at: string | null
  recovered_order_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Does this cart qualify for an automated reminder right now?
 * - Must not be recovered.
 * - Must have items and a subtotal > 0 (no point nudging empty carts).
 * - Must have sat idle long enough since the last touch/reminder.
 * - Must not have already received `MAX_REMINDERS` messages.
 *
 * Returns the reminder ordinal we'd send (1 or 2), or null if ineligible.
 */
export function nextReminderOrdinal(cart: AbandonedCartRow, now = Date.now()): 1 | 2 | null {
  if (cart.recovered_at) return null
  if (!Array.isArray(cart.items) || cart.items.length === 0) return null
  if (!cart.subtotal || cart.subtotal <= 0) return null
  if (cart.reminder_count >= MAX_REMINDERS) return null

  const lastTouch = new Date(cart.last_reminder_sent_at ?? cart.updated_at).getTime()
  const idleMs = now - lastTouch

  if (cart.reminder_count === 0 && idleMs >= FIRST_REMINDER_AFTER_MS) return 1
  if (cart.reminder_count === 1 && idleMs >= SECOND_REMINDER_AFTER_MS) return 2
  return null
}
