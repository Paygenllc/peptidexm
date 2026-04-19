import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { AbandonedCartsClient, type AbandonedCartView } from "./abandoned-carts-client"
import type { AbandonedCartRow } from "@/lib/abandoned-carts"

export const dynamic = "force-dynamic"

export default async function AbandonedCartsPage() {
  await requireAdmin()

  const admin = createAdminClient()
  // Cap the listing to the most recent 200 carts — plenty for the
  // recovery workflow and keeps the page responsive without pagination
  // in the v1 of this dashboard.
  const { data, error } = await admin
    .from("abandoned_carts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.log("[v0] abandoned-carts list error:", error)
  }

  const carts: AbandonedCartView[] = ((data ?? []) as AbandonedCartRow[]).map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    items: Array.isArray(c.items) ? c.items : [],
    subtotal: Number(c.subtotal) || 0,
    reminderCount: c.reminder_count,
    lastReminderSentAt: c.last_reminder_sent_at,
    recoveredAt: c.recovered_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="font-serif text-2xl sm:text-3xl text-foreground">
          Abandoned carts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Shoppers who entered their email at checkout but didn&apos;t place an
          order. Automated reminders go out at 30&nbsp;minutes and 24&nbsp;hours
          — you can also send one manually from here.
        </p>
      </header>

      <AbandonedCartsClient carts={carts} />
    </div>
  )
}
