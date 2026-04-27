import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Reply, Mail, AlertCircle } from "lucide-react"
import { InboxTabs } from "../inbox-tabs"
import { MessageActions } from "./message-actions"
import { markReadAction } from "@/app/admin/actions/inbox"

export const dynamic = "force-dynamic"

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: message } = await supabase
    .from("mail_messages")
    .select(
      "id, direction, from_email, from_name, to_email, subject, body_text, body_html, read_at, created_at, status, error_message, reply_to_id",
    )
    .eq("id", id)
    .maybeSingle()

  if (!message) notFound()

  // Auto-mark inbound messages as read the first time an admin opens them.
  if (message.direction === "inbound" && !message.read_at) {
    await markReadAction(message.id, true)
  }

  // Load the thread context: if this is a reply, show the original above;
  // if this is an original, show any replies beneath. Also fetch the
  // tab badge counts so the Chats tab's "new" pill stays accurate
  // when the operator is sitting on a mail detail.
  const [parentRes, childrenRes, unreadRes, newChatsRes] = await Promise.all([
    message.reply_to_id
      ? supabase
          .from("mail_messages")
          .select("id, direction, from_email, to_email, subject, created_at")
          .eq("id", message.reply_to_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("mail_messages")
      .select("id, direction, from_email, to_email, subject, created_at")
      .eq("reply_to_id", message.id)
      .order("created_at", { ascending: true }),
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

  const parent = parentRes.data
  const children = childrenRes.data ?? []
  const unreadCount = unreadRes.count ?? 0
  const newChatsCount = newChatsRes.count ?? 0

  const isInbound = message.direction === "inbound"
  const headerPerson = isInbound
    ? { label: "From", name: message.from_name, email: message.from_email }
    : { label: "To", name: null, email: message.to_email }

  const backHref = isInbound ? "/admin/inbox" : "/admin/inbox/outbox"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" /> {isInbound ? "Inbox" : "Outbox"}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Mail className="w-6 h-6" /> Mail
        </h1>
      </div>

      <InboxTabs unreadCount={unreadCount} newChatsCount={newChatsCount} />

      {parent && (
        <Card className="p-4 bg-secondary/30">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            In reply to
          </div>
          <Link
            href={`/admin/inbox/${parent.id}`}
            className="text-sm text-primary hover:underline"
          >
            {parent.subject}
          </Link>
          <div className="text-xs text-muted-foreground mt-0.5">
            {parent.direction === "inbound"
              ? `From ${parent.from_email}`
              : `To ${parent.to_email}`}{" "}
            ·{" "}
            {new Date(parent.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </Card>
      )}

      <Card className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground text-balance">
              {message.subject}
            </h2>
            <div className="text-sm text-muted-foreground">
              <span className="text-muted-foreground/80">{headerPerson.label}:</span>{" "}
              {headerPerson.name ? (
                <span className="text-foreground/90">
                  {headerPerson.name}{" "}
                  <span className="text-muted-foreground">&lt;{headerPerson.email}&gt;</span>
                </span>
              ) : (
                <span className="text-foreground/90">{headerPerson.email}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DirectionBadge direction={message.direction} status={message.status} />
          </div>
        </div>

        {message.status === "failed" && message.error_message && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Send failed</div>
              <div className="text-xs text-destructive/90 mt-0.5">{message.error_message}</div>
            </div>
          </div>
        )}

        <div className="prose prose-sm max-w-none whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
          {message.body_text}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-border">
          <MessageActions
            id={message.id}
            isInbound={isInbound}
            isRead={Boolean(message.read_at)}
          />
          {isInbound && (
            <Button asChild className="gap-2">
              <Link href={`/admin/inbox/compose?reply=${message.id}`}>
                <Reply className="h-4 w-4" /> Reply
              </Link>
            </Button>
          )}
        </div>
      </Card>

      {children.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Replies ({children.length})
          </h3>
          <ul className="space-y-2 text-sm">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/inbox/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                >
                  <span className="min-w-0">
                    <span className="block text-primary truncate">{c.subject}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {c.direction === "inbound" ? `From ${c.from_email}` : `To ${c.to_email}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function DirectionBadge({ direction, status }: { direction: string; status: string }) {
  if (direction === "inbound") {
    if (status === "forwarded") return <Badge variant="secondary">Forwarded</Badge>
    return <Badge variant="outline">Received</Badge>
  }
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>
  if (status === "sent") return <Badge className="bg-green-600 hover:bg-green-600">Sent</Badge>
  return <Badge variant="outline" className="capitalize">{status}</Badge>
}
