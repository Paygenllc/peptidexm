import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, ExternalLink } from "lucide-react"
import { InboxTabs } from "../../inbox-tabs"
import { ChatActions } from "./chat-actions"
import { ReplyByEmailButton } from "./reply-by-email-button"

export const dynamic = "force-dynamic"

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: chat }, unreadRes, newChatsRes] = await Promise.all([
    supabase
      .from("chat_messages")
      .select(
        "id, name, email, phone, message, submitted_when, status, page_url, user_agent, ip_address, admin_notes, created_at, replied_at",
      )
      .eq("id", id)
      .maybeSingle(),
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

  if (!chat) notFound()

  const unreadCount = unreadRes.count ?? 0
  const newChatsCount = newChatsRes.count ?? 0

  // Build the pre-filled reply body once on the server. The
  // ReplyByEmailButton client component takes these three pieces and
  // routes them to Gmail / Outlook / Yahoo / default mail app —
  // whichever the operator actually uses. We deliberately stopped
  // building a `mailto:` URL here because plain mailto: links no-op
  // for the majority of desktop users (no registered handler).
  const greeting = chat.name?.trim() ? `Hi ${chat.name.trim()},` : "Hi,"
  const quotedMessage = chat.message
    .split("\n")
    .map((l: string) => `> ${l}`)
    .join("\n")
  const replySubject = "Re: your message to PeptideXM"
  const replyBody = `${greeting}\n\nThanks for reaching out via the chat bubble on peptidexm.com.\n\n\n\n--- Your original message ---\n${quotedMessage}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link href="/admin/inbox/chats">
            <ArrowLeft className="h-4 w-4" /> Chats
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Mail className="w-6 h-6" /> Mail
        </h1>
      </div>

      <InboxTabs unreadCount={unreadCount} newChatsCount={newChatsCount} />

      <Card className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5 min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground text-balance">
              {chat.name?.trim() || "Anonymous visitor"}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <a
                href={`mailto:${chat.email}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="w-3.5 h-3.5" /> {chat.email}
              </a>
              {chat.phone && (
                <a
                  href={`tel:${chat.phone}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="w-3.5 h-3.5" /> {chat.phone}
                </a>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(chat.created_at).toLocaleString("en-US", {
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
            {chat.submitted_when === "offline" ? (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-300"
              >
                After-hours
              </Badge>
            ) : (
              <Badge variant="outline">During hours</Badge>
            )}
            {chat.status === "new" && (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">New</Badge>
            )}
            {chat.status === "replied" && (
              <Badge className="bg-green-600/90 hover:bg-green-600">Replied</Badge>
            )}
          </div>
        </div>

        <div className="prose prose-sm max-w-none whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
          {chat.message}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
          <ReplyByEmailButton
            to={chat.email}
            subject={replySubject}
            body={replyBody}
          />
          {chat.phone && (
            <Button asChild variant="outline" className="gap-2 bg-transparent">
              <a href={`tel:${chat.phone}`}>
                <Phone className="w-4 h-4" /> Call
              </a>
            </Button>
          )}
          {chat.page_url && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5 ml-auto">
              <a href={chat.page_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Page they were on</span>
                <span className="sm:hidden">Source page</span>
              </a>
            </Button>
          )}
        </div>
      </Card>

      <ChatActions
        id={chat.id}
        status={chat.status}
        notes={chat.admin_notes ?? ""}
      />

      {/* Diagnostic metadata, collapsed by default in a small footer
        * because most operators won't need it but it's invaluable when
        * a lead claims they "didn't submit anything." */}
      <details className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-foreground/80 font-medium">
          Submission metadata
        </summary>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted-foreground/80">Page URL</dt>
          <dd className="font-mono break-all">{chat.page_url || "—"}</dd>
          <dt className="text-muted-foreground/80">User agent</dt>
          <dd className="font-mono break-all">{chat.user_agent || "—"}</dd>
          <dt className="text-muted-foreground/80">IP address</dt>
          <dd className="font-mono">{chat.ip_address || "—"}</dd>
          <dt className="text-muted-foreground/80">Replied at</dt>
          <dd className="font-mono">
            {chat.replied_at
              ? new Date(chat.replied_at).toLocaleString("en-US")
              : "—"}
          </dd>
        </dl>
      </details>
    </div>
  )
}
