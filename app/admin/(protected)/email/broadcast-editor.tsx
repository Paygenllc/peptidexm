"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createBroadcastDraftAction,
  updateBroadcastAction,
  deleteBroadcastAction,
  sendBroadcastAction,
} from "@/app/admin/actions/broadcasts"
import { Loader2, Send, Save, Trash2, Eye, Pencil } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type EditorInitial = {
  id: string
  subject: string
  preview: string | null
  body_markdown: string
  audience: string
  status: string
  sent_at: string | null
  recipient_count: number
  sent_count: number
  failed_count: number
}

export function BroadcastEditor({
  mode,
  initial,
}: {
  mode: "create" | "edit"
  initial?: EditorInitial
}) {
  const [subject, setSubject] = useState(initial?.subject ?? "")
  const [preview, setPreview] = useState(initial?.preview ?? "")
  const [body, setBody] = useState(initial?.body_markdown ?? "")
  const [audience, setAudience] = useState(initial?.audience ?? "subscribers")
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sent = initial?.status === "sent"
  const sending = initial?.status === "sending"
  const locked = sent || sending

  function handleSave(formData: FormData) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = mode === "create"
        ? await createBroadcastDraftAction(formData)
        : await updateBroadcastAction(formData)
      if (result?.error) setError(result.error)
      else if (result?.success) setMessage("Draft saved")
    })
  }

  async function handleSend() {
    if (!initial) return
    if (!confirm(`Send this broadcast to ${audienceDescription(audience)}? This cannot be undone.`)) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("id", initial.id)
      const res = await sendBroadcastAction(fd)
      if (res?.error) setError(res.error)
      else if (res?.success) setMessage(`Sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}${res.failed ? ` · ${res.failed} failed` : ""}`)
    })
  }

  async function handleDelete() {
    if (!initial) return
    if (!confirm("Delete this broadcast? This cannot be undone.")) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("id", initial.id)
      const res = await deleteBroadcastAction(fd)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form action={handleSave} className="lg:col-span-2 space-y-5">
        {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="A short, compelling subject line"
              disabled={locked}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Shown in the inbox. Keep it under 60 characters for best display.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preview">Preview text</Label>
            <Input
              id="preview"
              name="preview"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Optional preview shown next to the subject in most inboxes"
              disabled={locked}
              maxLength={180}
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="body">Body</Label>
            <div className="flex rounded-md border border-border p-0.5 bg-secondary/40">
              <button
                type="button"
                onClick={() => setTab("write")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  tab === "write" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Pencil className="w-3 h-3" /> Write
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  tab === "preview" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            </div>
          </div>

          {tab === "write" ? (
            <>
              <Textarea
                id="body"
                name="body_markdown"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={16}
                disabled={locked}
                placeholder={`# Hello there\n\nA quick update from the PeptideXM team...\n\n- **New arrivals** this week\n- _10% off_ through Friday\n\n[Shop now](https://peptidexm.com/products)`}
                className="font-mono text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Markdown supported: # heading, **bold**, _italic_, [link](url), - list, {"> "}quote.
              </p>
            </>
          ) : (
            <div className="rounded-md border border-border bg-background p-5 min-h-[320px] prose prose-sm max-w-none prose-headings:font-serif prose-headings:font-medium prose-a:text-primary">
              {body.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </Card>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-foreground rounded-md bg-green-50 border border-green-200 px-3 py-2">
            {message}
          </p>
        )}

        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {mode === "create" ? "Save draft" : "Save changes"}
            </Button>
            {mode === "edit" && initial?.status === "draft" && (
              <Button type="button" variant="secondary" onClick={handleSend} disabled={isPending} className="gap-2">
                <Send className="w-4 h-4" />
                Send now
              </Button>
            )}
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isPending}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>
        )}
      </form>

      <aside className="space-y-5">
        <Card className="p-5 space-y-4">
          <div>
            <Label htmlFor="audience">Audience</Label>
            <Select name="audience" value={audience} onValueChange={setAudience} disabled={locked}>
              <SelectTrigger id="audience" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subscribers">Newsletter subscribers</SelectItem>
                <SelectItem value="all_customers">All customers</SelectItem>
                <SelectItem value="admins">Admins only (test)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">{audienceDescription(audience)}</p>
          </div>
        </Card>

        {initial && (
          <Card className="p-5 space-y-3 text-sm">
            <h3 className="font-semibold">Status</h3>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">State</span>
              <Badge variant={statusVariant(initial.status)} className="capitalize">
                {initial.status}
              </Badge>
            </div>
            {initial.sent_at && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Sent</span>
                <span>
                  {new Date(initial.sent_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            )}
            {(initial.status === "sent" || initial.status === "sending") && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="tabular-nums">{initial.recipient_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Delivered</span>
                  <span className="tabular-nums">{initial.sent_count}</span>
                </div>
                {initial.failed_count > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="tabular-nums text-destructive">{initial.failed_count}</span>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </aside>
    </div>
  )
}

function audienceDescription(a: string) {
  if (a === "subscribers") return "Active customers with marketing subscription turned on."
  if (a === "all_customers") return "Every customer with an account, excluding banned users."
  if (a === "admins") return "Your internal admin team only — useful for testing."
  return ""
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "sent") return "default"
  if (s === "sending") return "secondary"
  if (s === "failed") return "destructive"
  return "outline"
}
