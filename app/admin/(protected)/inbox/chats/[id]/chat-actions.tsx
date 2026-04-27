"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Check, Archive, RotateCcw } from "lucide-react"
import {
  setChatStatusAction,
  setChatNotesAction,
} from "@/app/admin/actions/chats"

/**
 * Status + notes editor for a single chat lead. Lives in its own
 * client component because the actions are interactive (transitions,
 * inline error toasts) while the surrounding detail page is a pure
 * RSC. Keeping the boundary narrow means the page itself stays
 * cacheable and we don't rehydrate the message content on every
 * keystroke in the notes field.
 */
export function ChatActions({
  id,
  status,
  notes,
}: {
  id: string
  status: string
  notes: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState(notes)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function changeStatus(next: "new" | "replied" | "archived") {
    setError(null)
    startTransition(async () => {
      const res = await setChatStatusAction({ id, status: next })
      if ("error" in res) setError(res.error)
    })
  }

  function saveNotes() {
    setError(null)
    startTransition(async () => {
      const res = await setChatNotesAction({ id, notes: notesDraft })
      if ("error" in res) {
        setError(res.error)
      } else {
        setSavedAt(Date.now())
        // Auto-clear the "saved" indicator after a few seconds so it
        // doesn't sit there forever pretending everything is fresh.
        setTimeout(() => setSavedAt(null), 2500)
      }
    })
  }

  const dirty = notesDraft.trim() !== notes.trim()

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Status</h3>
        <p className="text-xs text-muted-foreground">
          Mark as replied once you&apos;ve emailed or called the visitor back. The
          Chats tab badge shows the count of leads still in &ldquo;new.&rdquo;
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {status !== "replied" && (
            <Button
              size="sm"
              onClick={() => changeStatus("replied")}
              disabled={pending}
              className="gap-1.5"
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Mark replied
            </Button>
          )}
          {status === "replied" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus("new")}
              disabled={pending}
              className="gap-1.5 bg-transparent"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reopen
            </Button>
          )}
          {status !== "archived" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => changeStatus("archived")}
              disabled={pending}
              className="gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          )}
          {status === "archived" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus("new")}
              disabled={pending}
              className="gap-1.5 bg-transparent"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Internal notes</h3>
          {savedAt && (
            <span className="text-xs text-green-600 inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Visible only to admins. Use this to track follow-ups, link to
          related orders, or note voicemail callbacks.
        </p>
        <Textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={4}
          placeholder="No notes yet."
          maxLength={2000}
          disabled={pending}
        />
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            onClick={saveNotes}
            disabled={pending || !dirty}
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Save notes
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}
