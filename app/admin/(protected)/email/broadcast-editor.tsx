"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
  duplicateBroadcastAction,
  sendBroadcastAction,
  type BroadcastDraft,
} from "@/app/admin/actions/broadcasts"
import { Loader2, Send, Save, Trash2, Eye, Pencil, Copy } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ProductPicker } from "@/components/admin/product-picker"
import { BroadcastDrafter } from "./broadcast-drafter"

type EditorInitial = {
  id: string
  subject: string
  preview: string | null
  body_markdown: string
  audience: string
  custom_recipients: string[] | null
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
  const [customRecipients, setCustomRecipients] = useState(
    (initial?.custom_recipients ?? []).join("\n"),
  )
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  /**
   * Build FormData from the controlled state rather than the DOM.
   *
   * The audience Select and custom-recipients Textarea live in the `<aside>`
   * (outside the main `<form>`) for layout reasons, which means a native
   * form submission wouldn't include them. Reading from state makes the
   * server action behaviour independent of how the markup is arranged —
   * any visible field always ends up in the payload.
   */
  function buildFormData(): FormData {
    const fd = new FormData()
    if (mode === "edit" && initial) fd.set("id", initial.id)
    fd.set("subject", subject)
    fd.set("preview", preview)
    fd.set("body_markdown", body)
    fd.set("audience", audience)
    fd.set("custom_recipients", customRecipients)
    return fd
  }

  const sent = initial?.status === "sent"
  const sending = initial?.status === "sending"
  const locked = sent || sending

  /**
   * Insert a product token at the current cursor in the body textarea.
   * We wrap the token with blank lines so our markdown renderer treats it as
   * its own paragraph — the server-side embed expander can then cleanly swap
   * the wrapping `<p>` with the product card instead of nesting.
   */
  function insertProductToken(slug: string) {
    const ta = bodyRef.current
    const token = `[[product:${slug}]]`
    if (!ta) {
      // Fallback: append to the end if the ref isn't attached for some reason.
      setBody((prev) => `${prev}${prev.endsWith("\n") ? "" : "\n\n"}${token}\n\n`)
      return
    }
    const start = ta.selectionStart ?? body.length
    const end = ta.selectionEnd ?? body.length
    // Add surrounding blank lines only if we aren't already on one.
    const prefix = start === 0 || body.slice(0, start).endsWith("\n\n") ? "" : "\n\n"
    const suffix = body.slice(end).startsWith("\n\n") || end === body.length ? "\n\n" : "\n\n"
    const next = body.slice(0, start) + prefix + token + suffix + body.slice(end)
    setBody(next)
    const cursor = start + prefix.length + token.length + suffix.length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursor, cursor)
    })
  }

  /**
   * Save handler. Validates on the client so we give immediate feedback
   * without a round trip, then delegates to the right server action.
   * On create-success we navigate client-side; the server action no longer
   * calls `redirect()` because that pattern is brittle when mixed with
   * `startTransition`+`await` on Next 16.
   */
  async function handleSave(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault()
    setMessage(null)
    setError(null)

    if (!subject.trim()) {
      setError("Subject is required")
      return
    }
    if (!body.trim()) {
      setError("Body is required")
      return
    }

    const formData = buildFormData()

    startTransition(async () => {
      try {
        if (mode === "create") {
          const result = await createBroadcastDraftAction(formData)
          if ("error" in result && result.error) {
            setError(result.error)
            return
          }
          if ("success" in result && result.success && result.id) {
            router.push(`/admin/email/${result.id}`)
            return
          }
          setError("Unexpected response from server.")
        } else {
          const result = await updateBroadcastAction(formData)
          if ("error" in result && result.error) setError(result.error)
          else if ("success" in result && result.success) setMessage("Draft saved")
        }
      } catch (err) {
        console.log("[v0] handleSave: unexpected error", err)
        setError(err instanceof Error ? err.message : "Something went wrong while saving.")
      }
    })
  }

  async function handleSend() {
    if (!initial) return
    if (!confirm(`Send this broadcast to ${audienceDescription(audience)}? This cannot be undone.`)) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      // Pass the current, in-memory form state so the server can persist and
      // send atomically. Fixes the race where a user changes the audience
      // dropdown and clicks Send without saving first.
      const fd = new FormData()
      fd.set("id", initial.id)
      fd.set("subject", subject)
      fd.set("preview", preview)
      fd.set("body_markdown", body)
      fd.set("audience", audience)
      fd.set("custom_recipients", customRecipients)
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

  async function handleDuplicate() {
    if (!initial) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("id", initial.id)
      const res = await duplicateBroadcastAction(fd)
      // duplicateBroadcastAction redirects on success, so we only hit this
      // branch when it explicitly returns an error.
      if (res && "error" in res && res.error) setError(res.error)
    })
  }

  /**
   * Pull an AI-generated draft into the editor fields. We only overwrite
   * fields the model produced so a half-typed form is never silently wiped.
   */
  function applyAiDraft(draft: BroadcastDraft) {
    if (draft.subject) setSubject(draft.subject)
    if (draft.preview) setPreview(draft.preview)
    if (draft.body_markdown) setBody(draft.body_markdown)
    setTab("preview")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={handleSave} className="lg:col-span-2 space-y-5">
        {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

        {!locked && <BroadcastDrafter onGenerated={applyAiDraft} disabled={isPending} />}

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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label htmlFor="body">Body</Label>
            <div className="flex items-center gap-1">
              {tab === "write" && !locked && (
                <ProductPicker onInsert={insertProductToken} />
              )}
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
          </div>

          {tab === "write" ? (
            <>
              <Textarea
                ref={bodyRef}
                id="body"
                name="body_markdown"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={16}
                disabled={locked}
                placeholder={`# Hello there\n\nA quick update from the PeptideXM team...\n\n- **New arrivals** this week\n- _10% off_ through Friday\n\n[[product:bpc-157]]\n\n[Shop now](https://peptidexm.com/products)`}
                className="font-mono text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Markdown supported: # heading, **bold**, _italic_, [link](url), - list, {"> "}quote.
                Use the <span className="inline-flex items-center gap-1 align-middle"><span className="inline-block">Product</span></span> button above to insert a product card.
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

        {locked && mode === "edit" && initial && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleDuplicate}
              disabled={isPending}
              className="gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Duplicate as new draft
            </Button>
          </div>
        )}
      </form>

      <aside className="space-y-5">
        <Card className="p-5 space-y-5">
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
                <SelectItem value="custom">Custom list only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">{audienceDescription(audience)}</p>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="custom_recipients">
                {audience === "custom" ? "Recipients" : "Additional recipients"}
              </Label>
              <CustomCountBadge raw={customRecipients} />
            </div>
            <Textarea
              id="custom_recipients"
              name="custom_recipients"
              value={customRecipients}
              onChange={(e) => setCustomRecipients(e.target.value)}
              disabled={locked}
              rows={5}
              placeholder={"press@example.com\nvip@company.com\ninvestor@fund.co"}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {audience === "custom"
                ? "This broadcast will only be sent to these addresses."
                : "Sent in addition to the selected audience. Duplicates are skipped automatically."}
              {" "}One email per line, or separate with commas or semicolons.
            </p>
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
  if (a === "custom") return "Only the custom recipients listed below — no DB lookup."
  return ""
}

/** Live-parse the textarea so the admin sees how many emails will actually send. */
function CustomCountBadge({ raw }: { raw: string }) {
  const tokens = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = new Set<string>()
  let invalid = 0
  for (const t of tokens) {
    if (emailRe.test(t)) valid.add(t.toLowerCase())
    else invalid += 1
  }
  if (valid.size === 0 && invalid === 0) {
    return <span className="text-xs text-muted-foreground">none</span>
  }
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {valid.size} valid{invalid > 0 && <span className="text-destructive"> · {invalid} invalid</span>}
    </span>
  )
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "sent") return "default"
  if (s === "sending") return "secondary"
  if (s === "failed") return "destructive"
  return "outline"
}
