"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Send, Loader2 } from "lucide-react"
import { sendMailMessageAction } from "@/app/admin/actions/inbox"

type State = { error?: string } | null

export function ComposeForm({
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  replyToId,
}: {
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  replyToId?: string
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    sendMailMessageAction as unknown as (prev: State, fd: FormData) => Promise<State>,
    null,
  )

  return (
    <form action={formAction}>
      <Card className="p-5 sm:p-6 space-y-5">
        {replyToId && <input type="hidden" name="reply_to_id" value={replyToId} />}

        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            name="to"
            type="email"
            required
            placeholder="customer@example.com"
            defaultValue={defaultTo}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            type="text"
            required
            placeholder="Following up on your question"
            defaultValue={defaultSubject}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            name="body"
            required
            rows={12}
            placeholder="Write your message here..."
            defaultValue={defaultBody}
            className="font-sans text-sm leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Plain text; URLs are auto-linked. Sent via Resend from your
            configured support address.
          </p>
        </div>

        {state?.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="submit" disabled={pending} className="gap-2">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send
              </>
            )}
          </Button>
        </div>
      </Card>
    </form>
  )
}
