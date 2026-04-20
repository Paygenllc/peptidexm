"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Archive, Trash2, MailOpen, Mail, Loader2 } from "lucide-react"
import {
  archiveMessageAction,
  deleteMessageAction,
  markReadAction,
} from "@/app/admin/actions/inbox"

export function MessageActions({
  id,
  isInbound,
  isRead,
}: {
  id: string
  isInbound: boolean
  isRead: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isInbound && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => markReadAction(id, !isRead))}
          className="gap-2"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isRead ? (
            <Mail className="h-3.5 w-3.5" />
          ) : (
            <MailOpen className="h-3.5 w-3.5" />
          )}
          {isRead ? "Mark unread" : "Mark read"}
        </Button>
      )}

      {isInbound && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => archiveMessageAction(id))}
          className="gap-2"
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this message permanently?")) return
          startTransition(() => deleteMessageAction(id))
        }}
        className="gap-2 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  )
}
