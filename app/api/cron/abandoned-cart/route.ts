import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAbandonedCartReminderEmail } from "@/lib/email"
import {
  MAX_REMINDERS,
  FIRST_REMINDER_AFTER_MS,
  SECOND_REMINDER_AFTER_MS,
  getSiteUrl,
  nextReminderOrdinal,
  type AbandonedCartRow,
} from "@/lib/abandoned-carts"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// This cron handler runs once an hour (see vercel.json). We cap it at
// 60s — plenty of budget for a batch of a few dozen reminder emails but
// short enough that a Resend outage can't keep it running forever.
export const maxDuration = 60

/**
 * Vercel-scheduled abandoned-cart reminder processor.
 *
 * Security model: Vercel Cron hits this route with an `Authorization:
 * Bearer <CRON_SECRET>` header. We reject anything without a matching
 * `CRON_SECRET` env var. Without this, anyone who found the URL could
 * trigger an email blast to every abandoned-cart row.
 *
 * Behavior:
 *   - Pull any cart that's eligible by clock (30m for #1, 24h after
 *     #1 for #2).
 *   - For each eligible row, re-check `nextReminderOrdinal` in app code
 *     so the DB filter + app logic stay in sync.
 *   - Send email via Resend; bump the counter + timestamp on success.
 *   - Return a JSON summary for observability in Vercel logs.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const authHeader = req.headers.get("authorization") || ""
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  // Pull a generous window of candidates and let app logic narrow down.
  // The `updated_at` index on `recovered_at IS NULL` keeps this cheap.
  const firstCutoff = new Date(now - FIRST_REMINDER_AFTER_MS).toISOString()
  const secondCutoff = new Date(now - SECOND_REMINDER_AFTER_MS).toISOString()

  const { data: candidates, error } = await admin
    .from("abandoned_carts")
    .select("*")
    .is("recovered_at", null)
    .lt("reminder_count", MAX_REMINDERS)
    .or(`updated_at.lte.${firstCutoff},last_reminder_sent_at.lte.${secondCutoff}`)
    .order("updated_at", { ascending: true })
    .limit(50)

  if (error) {
    console.log("[v0] abandoned-cart cron select error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const siteUrl = getSiteUrl()
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const cart of (candidates ?? []) as AbandonedCartRow[]) {
    const ordinal = nextReminderOrdinal(cart, now)
    if (!ordinal) {
      skipped++
      continue
    }

    const recoveryUrl = `${siteUrl}/recover-cart/${encodeURIComponent(cart.token)}`
    const res = await sendAbandonedCartReminderEmail({
      firstName: cart.first_name,
      customerEmail: cart.email,
      ordinal,
      subtotal: Number(cart.subtotal) || 0,
      items: cart.items,
      recoveryUrl,
    })

    if ("error" in res && res.error) {
      console.log("[v0] abandoned-cart cron email error:", cart.id, res.error)
      failed++
      continue
    }
    if ("skipped" in res && res.skipped) {
      // Resend not configured — nothing we can do; stop iterating to
      // avoid a tight loop of "skipped" logs.
      skipped++
      continue
    }

    const { error: updErr } = await admin
      .from("abandoned_carts")
      .update({
        reminder_count: cart.reminder_count + 1,
        last_reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", cart.id)

    if (updErr) {
      console.log("[v0] abandoned-cart cron counter update error:", cart.id, updErr)
      failed++
    } else {
      sent++
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    sent,
    skipped,
    failed,
  })
}
