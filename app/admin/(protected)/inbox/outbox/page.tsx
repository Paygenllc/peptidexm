import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Send as SendIcon, PenSquare, Mail } from "lucide-react"
import { InboxTabs } from "../inbox-tabs"
import { Pagination, parsePage } from "@/components/admin/pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 25

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageRaw } = await searchParams
  const page = parsePage(pageRaw)
  const supabase = await createClient()
  const from = (page - 1) * PAGE_SIZE

  // Load unread inbound count so the Inbox tab badge stays accurate here.
  const [sentRes, unreadRes] = await Promise.all([
    supabase
      .from("mail_messages")
      .select("id, to_email, subject, body_text, created_at, status, error_message", {
        count: "exact",
      })
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    supabase
      .from("mail_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .is("read_at", null)
      .is("archived_at", null),
  ])

  const rows = sentRes.data ?? []
  const total = sentRes.count ?? 0
  const unreadCount = unreadRes.count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-6 h-6" /> Mail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Messages you&apos;ve sent from the admin inbox. Replies to these
            emails will land back in the main Inbox.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/inbox/compose" className="gap-2">
            <PenSquare className="w-4 h-4" /> Compose
          </Link>
        </Button>
      </div>

      <InboxTabs unreadCount={unreadCount} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border text-left">
              <tr>
                <th className="p-3 font-medium text-muted-foreground w-[28%]">To</th>
                <th className="p-3 font-medium text-muted-foreground">Subject</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    <SendIcon className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                    No sent messages yet.
                  </td>
                </tr>
              )}
              {rows.map((m) => {
                const preview = m.body_text.replace(/\s+/g, " ").slice(0, 120)
                return (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="p-3 align-top text-foreground/90 truncate">{m.to_email}</td>
                    <td className="p-3 align-top">
                      <Link
                        href={`/admin/inbox/${m.id}`}
                        className="block text-primary hover:underline"
                      >
                        {m.subject}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {preview}
                      </div>
                    </td>
                    <td className="p-3 align-top whitespace-nowrap">
                      <SentStatusBadge status={m.status} error={m.error_message} />
                    </td>
                    <td className="p-3 align-top text-muted-foreground whitespace-nowrap tabular-nums">
                      {new Date(m.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        basePath="/admin/inbox/outbox"
        params={{}}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  )
}

function SentStatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "failed") {
    return (
      <Badge variant="destructive" title={error ?? undefined}>
        Failed
      </Badge>
    )
  }
  if (status === "sent") return <Badge className="bg-green-600 hover:bg-green-600">Sent</Badge>
  return <Badge variant="outline" className="capitalize">{status}</Badge>
}
