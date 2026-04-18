import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Plus, Send, Users, ShieldCheck, FileText, History } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function BroadcastsPage() {
  const supabase = await createClient()

  const [broadcastsRes, audienceCountsRes] = await Promise.all([
    supabase
      .from("email_broadcasts")
      .select("id, subject, audience, status, recipient_count, sent_count, failed_count, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(50),
    // Parallel counts for each potential audience — shows admins
    // exactly how many people each audience option would touch.
    supabase
      .from("profiles")
      .select("is_admin, newsletter_subscribed, banned_at"),
  ])

  const broadcasts = broadcastsRes.data ?? []
  // Split by lifecycle: drafts (incl. in-flight / failed) vs. sent history.
  const drafts = broadcasts.filter((b) => b.status !== "sent")
  const history = broadcasts.filter((b) => b.status === "sent")
  const allProfiles = audienceCountsRes.data ?? []
  const subscribers = allProfiles.filter((p) => p.newsletter_subscribed && !p.banned_at).length
  const customers = allProfiles.filter((p) => !p.banned_at).length
  const admins = allProfiles.filter((p) => p.is_admin).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-6 h-6" /> Email
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compose and send broadcast emails to your customers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/email/subscribers" className="gap-2">
              <Users className="w-4 h-4" /> Subscribers
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/email/new" className="gap-2">
              <Plus className="w-4 h-4" /> New broadcast
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AudienceCard
          icon={<Mail className="w-4 h-4" />}
          label="Subscribers"
          count={subscribers}
          description="Active customers who opted into marketing"
        />
        <AudienceCard
          icon={<Users className="w-4 h-4" />}
          label="All customers"
          count={customers}
          description="Everyone with an account, excluding banned"
        />
        <AudienceCard
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Admins"
          count={admins}
          description="Your internal admin team"
        />
      </div>

      <BroadcastSection
        icon={<FileText className="w-4 h-4" />}
        title="Drafts"
        subtitle="Broadcasts you haven't sent yet. Click any row to keep editing."
        count={drafts.length}
        rows={drafts}
        emptyMessage="No drafts right now."
      />

      <BroadcastSection
        icon={<History className="w-4 h-4" />}
        title="History"
        subtitle="Every broadcast you've sent, newest first. Sent broadcasts cannot be edited."
        count={history.length}
        rows={history}
        emptyMessage="No broadcasts sent yet."
        showSentDate
      />
    </div>
  )
}

type BroadcastRow = {
  id: string
  subject: string
  audience: string
  status: string
  recipient_count: number | null
  sent_count: number | null
  failed_count: number | null
  created_at: string
  sent_at: string | null
}

function BroadcastSection({
  icon,
  title,
  subtitle,
  count,
  rows,
  emptyMessage,
  showSentDate = false,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  count: number
  rows: BroadcastRow[]
  emptyMessage: string
  showSentDate?: boolean
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              {icon}
            </span>
            {title}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border text-left">
              <tr>
                <th className="p-3 font-medium text-muted-foreground">Subject</th>
                <th className="p-3 font-medium text-muted-foreground">Audience</th>
                <th className="p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground">Sent / recipients</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">
                  {showSentDate ? "Sent" : "Updated"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <Send className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3">
                    <Link href={`/admin/email/${b.id}`} className="font-medium text-primary hover:underline">
                      {b.subject}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {audienceLabel(b.audience)}
                  </td>
                  <td className="p-3">
                    <Badge variant={statusVariant(b.status)} className="capitalize">
                      {b.status}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground tabular-nums">
                    {b.status === "sent" || b.status === "sending"
                      ? `${b.sent_count ?? 0} / ${b.recipient_count ?? 0}` +
                        ((b.failed_count ?? 0) > 0 ? ` · ${b.failed_count} failed` : "")
                      : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date((showSentDate && b.sent_at) || b.created_at).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

function AudienceCard({
  icon,
  label,
  count,
  description,
}: {
  icon: React.ReactNode
  label: string
  count: number
  description: string
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
          {icon}
        </span>
        <span className="text-xs sm:text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums">{count}</div>
      <p className="text-xs text-muted-foreground mt-1 text-pretty">{description}</p>
    </Card>
  )
}

function audienceLabel(a: string) {
  if (a === "all_customers") return "All customers"
  if (a === "subscribers") return "Subscribers"
  if (a === "admins") return "Admins"
  if (a === "custom") return "Custom list"
  return a
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "sent") return "default"
  if (s === "sending") return "secondary"
  if (s === "failed") return "destructive"
  return "outline"
}
