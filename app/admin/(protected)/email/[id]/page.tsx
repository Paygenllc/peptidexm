import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { BroadcastEditor } from "../broadcast-editor"

export const dynamic = "force-dynamic"

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: broadcast } = await supabase
    .from("email_broadcasts")
    .select("*")
    .eq("id", id)
    .single()

  if (!broadcast) notFound()

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/email"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to broadcasts
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{broadcast.subject}</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {broadcast.status} · {audienceLabel(broadcast.audience)}
          {broadcast.status === "sent" &&
            ` · ${broadcast.sent_count}/${broadcast.recipient_count} sent${
              broadcast.failed_count > 0 ? ` (${broadcast.failed_count} failed)` : ""
            }`}
        </p>
      </div>

      <BroadcastEditor
        mode="edit"
        initial={{
          id: broadcast.id,
          subject: broadcast.subject,
          preview: broadcast.preview,
          body_markdown: broadcast.body_markdown,
          audience: broadcast.audience,
          status: broadcast.status,
          sent_at: broadcast.sent_at,
          recipient_count: broadcast.recipient_count,
          sent_count: broadcast.sent_count,
          failed_count: broadcast.failed_count,
        }}
      />
    </div>
  )
}

function audienceLabel(a: string) {
  if (a === "all_customers") return "All customers"
  if (a === "subscribers") return "Subscribers"
  if (a === "admins") return "Admins"
  return a
}
