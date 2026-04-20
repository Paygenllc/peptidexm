import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Inbox as InboxIcon, PenSquare, Mail } from "lucide-react"
import { InboxTabs } from "./inbox-tabs"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const supabase = await createClient()

  const { data: messages } = await supabase
    .from("mail_messages")
    .select("id, from_email, from_name, subject, body_text, read_at, created_at, status")
    .eq("direction", "inbound")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100)

  const rows = messages ?? []
  const unreadCount = rows.filter((m) => !m.read_at).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-6 h-6" /> Mail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Incoming contact submissions and admin-sent replies. Every inbound
            message is also forwarded to peptidexm@gmail.com.
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
                <th className="p-3 font-medium text-muted-foreground w-[28%]">From</th>
                <th className="p-3 font-medium text-muted-foreground">Subject</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">
                  Received
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    <InboxIcon className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                    Your inbox is empty.
                  </td>
                </tr>
              )}
              {rows.map((m) => {
                const unread = !m.read_at
                const preview = m.body_text.replace(/\s+/g, " ").slice(0, 120)
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-border last:border-0 hover:bg-accent/30 ${
                      unread ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="p-3 align-top">
                      <div className={`truncate ${unread ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                        {m.from_name || m.from_email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.from_email}</div>
                    </td>
                    <td className="p-3 align-top">
                      <Link
                        href={`/admin/inbox/${m.id}`}
                        className={`block hover:underline ${unread ? "font-semibold text-foreground" : "text-primary"}`}
                      >
                        {m.subject}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {preview}
                      </div>
                    </td>
                    <td className="p-3 align-top whitespace-nowrap">
                      <StatusBadge status={m.status} unread={unread} />
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
    </div>
  )
}

function StatusBadge({ status, unread }: { status: string; unread: boolean }) {
  if (unread) return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Unread</Badge>
  if (status === "forwarded") return <Badge variant="secondary">Forwarded</Badge>
  if (status === "received") return <Badge variant="outline">Received</Badge>
  return <Badge variant="outline" className="capitalize">{status}</Badge>
}
