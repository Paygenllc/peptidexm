import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSiteUrl } from "@/lib/abandoned-carts"
import { sendPaymentReminderEmail } from "@/lib/email"
import {
  MAX_PAYMENT_REMINDERS,
  daysSince,
  nextPaymentReminderOrdinal,
  type PendingOrderRow,
} from "@/lib/payment-reminders"

export const runtime = "nodejs"
// Reminders send real email; we don't want edge caching on either the
// fetch or the response. `force-dynamic` is the right mode for cron.
export const dynamic = "force-dynamic"

/**
 * GET /api/cron/payment-reminders
 *
 * Runs on a Vercel Cron schedule (see vercel.json). For each pending
 * order whose cadence is due, sends the next reminder email and bumps
 * the counter on the row. Caps at MAX_PAYMENT_REMINDERS per order and
 * at 20 emails per invocation so one bad run can't flood our sender
 * reputation.
 *
 * Auth model matches /api/cron/abandoned-cart:
 *  - In Vercel production, the platform sets `x-vercel-cron` and the
 *    `Authorization: Bearer <CRON_SECRET>` header is auto-injected.
 *  - Locally or via curl, pass `?secret=<CRON_SECRET>` for manual testing.
 *  - Requests with neither are rejected.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const vercelCron = req.headers.get("x-vercel-cron")
  const querySecret = req.nextUrl.searchParams.get("secret")

  const authorizedByBearer =
    cronSecret && authHeader === `Bearer ${cronSecret}`
  const authorizedByQuery = cronSecret && querySecret === cronSecret
  const authorizedByVercel = Boolean(vercelCron)

  if (!authorizedByBearer && !authorizedByQuery && !authorizedByVercel) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()

  // Pull a generous window of candidates and filter in JS with the
  // shared helper — keeps the cadence logic in one place
  // (`nextPaymentReminderOrdinal`) rather than also encoded as SQL.
  // The partial index on orders makes this cheap even as volume grows.
  const { data: pending, error } = await admin
    .from("orders")
    .select(
      "id, order_number, email, first_name, last_name, total, status, payment_status, payment_reminder_count, last_payment_reminder_sent_at, created_at",
    )
    .eq("payment_status", "pending")
    .not("status", "in", "(cancelled,refunded)")
    .lt("payment_reminder_count", MAX_PAYMENT_REMINDERS)
    .order("created_at", { ascending: true })
    .limit(100)

  if (error) {
    console.log("[v0] payment-reminders cron fetch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const siteUrl = getSiteUrl()
  const results: Array<{ id: string; ordinal: number; ok: boolean; error?: string }> = []

  const batch = ((pending ?? []) as PendingOrderRow[]).slice(0, 100)
  let sent = 0

  for (const order of batch) {
    if (sent >= 20) break

    const ordinal = nextPaymentReminderOrdinal(order, now)
    if (ordinal === null) continue

    const customerName =
      [order.first_name, order.last_name].filter(Boolean).join(" ").trim() || "there"

    const emailResult = await sendPaymentReminderEmail({
      orderNumber: order.order_number,
      total: Number(order.total),
      customerName,
      customerEmail: order.email,
      ordinal,
      daysSinceOrder: daysSince(order.created_at, now),
      payUrl: `${siteUrl}/account`,
    })

    // sendEmail returns `{skipped, id?, error?}` — translate that into our
    // own `ok/error` record. We only bump the counter on a real send (id
    // present). If RESEND_API_KEY isn't set we log-and-skip rather than
    // burning the reminder slot.
    if ("error" in emailResult && emailResult.error !== undefined) {
      const msg =
        emailResult.error instanceof Error
          ? emailResult.error.message
          : String(emailResult.error)
      console.log("[v0] payment-reminders cron send failed:", order.id, msg)
      results.push({ id: order.id, ordinal, ok: false, error: msg })
      continue
    }
    if (emailResult.skipped) {
      console.log("[v0] payment-reminders cron: RESEND not configured, skipping", order.id)
      results.push({
        id: order.id,
        ordinal,
        ok: false,
        error: "email disabled (no RESEND_API_KEY)",
      })
      continue
    }

    const { error: updErr } = await admin
      .from("orders")
      .update({
        payment_reminder_count: (order.payment_reminder_count ?? 0) + 1,
        last_payment_reminder_sent_at: new Date(now).toISOString(),
      })
      .eq("id", order.id)

    if (updErr) {
      console.log("[v0] payment-reminders cron counter update failed:", order.id, updErr)
    }

    sent += 1
    results.push({ id: order.id, ordinal, ok: true })
  }

  return NextResponse.json({
    scanned: batch.length,
    sent,
    results,
  })
}
