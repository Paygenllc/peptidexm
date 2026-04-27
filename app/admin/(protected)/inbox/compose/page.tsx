import { createClient } from "@/lib/supabase/server"
import { Mail } from "lucide-react"
import { InboxTabs } from "../inbox-tabs"
import { ComposeForm } from "./compose-form"

export const dynamic = "force-dynamic"

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; subject?: string; reply?: string }>
}) {
  const { to, subject, reply } = await searchParams
  const supabase = await createClient()

  // If replying, look up the original so we can pre-fill To/Subject/quote.
  let defaultTo = to ?? ""
  let defaultSubject = subject ?? ""
  let defaultBody = ""
  let replyToId: string | undefined

  if (reply) {
    const { data: original } = await supabase
      .from("mail_messages")
      .select("id, from_email, subject, body_text, from_name, created_at")
      .eq("id", reply)
      .maybeSingle()
    if (original) {
      replyToId = original.id
      defaultTo = original.from_email
      defaultSubject = original.subject.toLowerCase().startsWith("re:")
        ? original.subject
        : `Re: ${original.subject}`
      const when = new Date(original.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      const quoted = original.body_text
        .split("\n")
        .map((l: string) => `> ${l}`)
        .join("\n")
      defaultBody = `\n\nOn ${when}, ${original.from_name ?? original.from_email} wrote:\n${quoted}`
    }
  }

  // Tab badges: unread inbound mail and new chat-bubble leads. We
  // run them in parallel; both are head-only counts so the cost is
  // negligible compared to the rest of the page.
  const [unreadRes, newChatsRes] = await Promise.all([
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
  const unreadCount = unreadRes.count ?? 0
  const newChatsCount = newChatsRes.count ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Mail className="w-6 h-6" /> {replyToId ? "Reply" : "Compose"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {replyToId
            ? "Replying to a message from your inbox."
            : "Write a new email to a customer. It will be sent via Resend and logged to your Outbox."}
        </p>
      </div>

      <InboxTabs unreadCount={unreadCount} newChatsCount={newChatsCount} />

      <ComposeForm
        defaultTo={defaultTo}
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
        replyToId={replyToId}
      />
    </div>
  )
}
