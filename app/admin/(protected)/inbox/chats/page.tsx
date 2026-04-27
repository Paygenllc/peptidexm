import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Mail, Phone } from "lucide-react"
import { InboxTabs } from "../inbox-tabs"
import { Pagination, parsePage } from "@/components/admin/pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 25

export default async function ChatsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageRaw } = await searchParams
  const page = parsePage(pageRaw)
  const supabase = await createClient()
  const from = (page - 1) * PAGE_SIZE

  // Run the page query, the unread-mail count (Inbox tab badge),
  // and the new-chats count (Chats tab badge) in parallel. The
  // chats badge is the same query as the list `count` filtered to
  // status=new, but we keep them separate so the list can be
  // sorted-by-newest while the badge ignores order entirely.
  const [chatsRes, unreadRes, newChatsRes] = await Promise.all([
    supabase
      .from("chat_messages")
      .select(
        "id, name, email, phone, message, submitted_when, status, page_url, created_at, replied_at",
        { count: "exact" },
      )
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    supabase
      .from("mail_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .is("read_at", null)
      .is("archived_at", null),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ])

  const rows = chatsRes.data ?? []
  const total = chatsRes.count ?? 0
  const unreadCount = unreadRes.count ?? 0
  const newChatsCount = newChatsRes.count ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Mail className="w-6 h-6" /> Mail
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Leads collected by the floating chat bubble. After-hours
          submissions need a reply within 24 hours per the on-site copy.
        </p>
      </div>

      <InboxTabs unreadCount={unreadCount} newChatsCount={newChatsCount} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border text-left">
              <tr>
                <th className="p-3 font-medium text-muted-foreground w-[28%]">From</th>
                <th className="p-3 font-medium text-muted-foreground">Message</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">When</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    <MessageSquare className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                    No chat leads yet.
                  </td>
                </tr>
              )}
              {rows.map((m) => {
                const isNew = m.status === "new"
                const preview = (m.message || "").replace(/\s+/g, " ").slice(0, 120)
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-border last:border-0 hover:bg-accent/30 ${
                      isNew ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="p-3 align-top">
                      <div
                        className={`truncate ${
                          isNew ? "font-semibold text-foreground" : "text-foreground/90"
                        }`}
                      >
                        {m.name?.trim() || m.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        {m.email}
                      </div>
                      {m.phone && (
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          {m.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <Link
                        href={`/admin/inbox/chats/${m.id}`}
                        className={`block hover:underline ${
                          isNew ? "font-semibold text-foreground" : "text-primary"
                        }`}
                      >
                        {preview || "(empty message)"}
                      </Link>
                    </td>
                    <td className="p-3 align-top whitespace-nowrap">
                      <WhenBadge when={m.submitted_when} />
                    </td>
                    <td className="p-3 align-top whitespace-nowrap">
                      <StatusBadge status={m.status} isNew={isNew} />
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
        basePath="/admin/inbox/chats"
        params={{}}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  )
}

function WhenBadge({ when }: { when: string }) {
  if (when === "offline") {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
        After-hours
      </Badge>
    )
  }
  return <Badge variant="outline">During hours</Badge>
}

function StatusBadge({ status, isNew }: { status: string; isNew: boolean }) {
  if (isNew) return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">New</Badge>
  if (status === "replied")
    return <Badge className="bg-green-600/90 hover:bg-green-600">Replied</Badge>
  return (
    <Badge variant="outline" className="capitalize">
      {status}
    </Badge>
  )
}
