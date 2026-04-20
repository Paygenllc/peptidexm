"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { generateBlogDraftAction } from "@/app/admin/actions/autoblog"

export type AutoblogDraft = {
  title: string
  slug: string
  excerpt: string
  content_html: string
  tags: string[]
}

/**
 * Autoblog: AI-assisted first-draft generator.
 *
 * Typing a topic and clicking "Generate" calls the server action, which uses
 * the AI SDK with `Output.object()` to produce a structured post draft. On
 * success we hand the draft back up to the editor via `onGenerated`, which
 * fills the form fields in place — the admin then edits, reviews in the
 * Preview tab, and publishes normally. Nothing is persisted until Save.
 */
export function AutoblogPanel({
  onGenerated,
}: {
  onGenerated: (draft: AutoblogDraft) => void
}) {
  const [open, setOpen] = useState(true)
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState("research")
  const [length, setLength] = useState("medium")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    setInfo(null)
    const trimmed = topic.trim()
    if (!trimmed) {
      setError("Enter a topic first.")
      return
    }

    const fd = new FormData()
    fd.set("topic", trimmed)
    fd.set("tone", tone)
    fd.set("length", length)

    startTransition(async () => {
      try {
        const result = await generateBlogDraftAction(fd)
        if (!result) {
          setError("No response from the AI. Try again.")
          return
        }
        if ("error" in result) {
          setError(result.error)
          return
        }
        onGenerated(result.draft)
        setInfo(
          "Draft generated. Review the Title, Excerpt, and Content below — edit anything before publishing.",
        )
      } catch (err) {
        console.error("[v0] autoblog generate failed:", err)
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't generate a draft. Please try again.",
        )
      }
    })
  }

  return (
    <Card className="p-0 overflow-hidden border-accent/40 bg-accent/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-accent/20 text-accent-foreground">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="font-medium text-foreground">Autoblog — generate a draft from a topic</span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-accent/20">
          <div className="space-y-2">
            <Label htmlFor="autoblog-topic">Topic</Label>
            <Textarea
              id="autoblog-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={
                "e.g. 'The research rationale for BPC-157 in tendon repair models' or 'How GLP-1 agonists compare: semaglutide vs tirzepatide'"
              }
              maxLength={500}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Be specific. The AI knows our full product catalog and will insert product cards where relevant.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="autoblog-tone">Tone</Label>
              <Select value={tone} onValueChange={setTone} disabled={isPending}>
                <SelectTrigger id="autoblog-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research (measured, evidence-led)</SelectItem>
                  <SelectItem value="educational">Educational (plain-English explainer)</SelectItem>
                  <SelectItem value="news">Research news brief</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoblog-length">Length</Label>
              <Select value={length} onValueChange={setLength} disabled={isPending}>
                <SelectTrigger id="autoblog-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (~500-700 words)</SelectItem>
                  <SelectItem value="medium">Medium (~900-1200 words)</SelectItem>
                  <SelectItem value="long">Long (~1500-2000 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2"
            >
              {error}
            </p>
          )}
          {info && !error && (
            <p className="text-sm text-foreground rounded-md bg-green-50 border border-green-200 px-3 py-2">
              {info}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Generated drafts are a starting point — review everything before publishing.
            </p>
            <Button type="button" onClick={handleGenerate} disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isPending ? "Generating…" : "Generate draft"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
