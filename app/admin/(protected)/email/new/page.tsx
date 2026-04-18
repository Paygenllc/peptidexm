import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BroadcastEditor } from "../broadcast-editor"

export const dynamic = "force-dynamic"

export default function NewBroadcastPage() {
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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">New broadcast</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compose an email campaign. It&apos;ll be saved as a draft — you can review, edit, and send when ready.
        </p>
      </div>

      <BroadcastEditor mode="create" />
    </div>
  )
}
