"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sparkles, Loader2, ChevronDown, ChevronUp, Wand2 } from "lucide-react"
import {
  generateBlogDraftAction,
  remixBlogDraftAction,
} from "@/app/admin/actions/autoblog"
import { AUTOBLOG_TONES, AUTOBLOG_LENGTHS } from "@/lib/autoblog-config"

export type AutoblogDraft = {
  title: string
  slug: string
  excerpt: string
  content_html: string
  tags: string[]
}

type Mode = "topic" | "remix"

/**
 * Autoblog: AI-assisted first-draft generator.
 *
 * Two entry points share the same tone/length/audience/keywords controls:
 *   • "From topic"  → describe what you want, the model writes it.
 *   • "Remix article" → paste an existing article, the model rewrites it
 *                       in PeptideXM voice with our product catalog
 *                       (anti-plagiarism framing enforced server-side).
 *
 * On success we hand the draft back up to the editor via `onGenerated`,
 * which fills the form fields in place — the admin then edits, reviews
 * in the Preview tab, and publishes normally. Nothing is persisted
 * until Save.
 */
export function AutoblogPanel({
  onGenerated,
}: {
  onGenerated: (draft: AutoblogDraft) => void
}) {
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState<Mode>("topic")

  // Topic-mode fields.
  const [topic, setTopic] = useState("")

  // Remix-mode fields. `source` is the pasted article; `source_url` and
  // `focus` are optional hints the model uses without publishing them.
  const [source, setSource] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [focus, setFocus] = useState("")

  // Shared across both modes.
  const [keywords, setKeywords] = useState("")
  const [audience, setAudience] = useState("")
  const [tone, setTone] = useState<keyof typeof AUTOBLOG_TONES>("research")
  const [length, setLength] = useState<keyof typeof AUTOBLOG_LENGTHS>("medium")

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    setInfo(null)

    const fd = new FormData()

    if (mode === "topic") {
      const trimmed = topic.trim()
      if (!trimmed) {
        setError("Enter a topic first.")
        return
      }
      fd.set("topic", trimmed)
    } else {
      const src = source.trim()
      if (!src) {
        setError("Paste the source article first.")
        return
      }
      if (src.length < 200) {
        setError("Source is too short to remix — paste the full article.")
        return
      }
      fd.set("source", src)
      if (sourceUrl.trim()) fd.set("source_url", sourceUrl.trim())
      if (focus.trim()) fd.set("focus", focus.trim())
    }

    fd.set("keywords", keywords.trim())
    fd.set("audience", audience.trim())
    fd.set("tone", tone)
    fd.set("length", length)

    startTransition(async () => {
      try {
        const result =
          mode === "topic"
            ? await generateBlogDraftAction(fd)
            : await remixBlogDraftAction(fd)
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
          mode === "topic"
            ? "Draft generated. Review the Title, Excerpt, and Content below — edit anything before publishing."
            : "Remix ready. Compare carefully against the source, edit freely, then publish when happy.",
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

  const sourceChars = source.length

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
          <span className="font-medium text-foreground">Autoblog — generate or remix a draft</span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-accent/20">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-sm">
              <TabsTrigger value="topic" className="gap-1.5" disabled={isPending}>
                <Sparkles className="w-3.5 h-3.5" />
                From topic
              </TabsTrigger>
              <TabsTrigger value="remix" className="gap-1.5" disabled={isPending}>
                <Wand2 className="w-3.5 h-3.5" />
                Remix article
              </TabsTrigger>
            </TabsList>

            <TabsContent value="topic" className="mt-4 space-y-2">
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
            </TabsContent>

            <TabsContent value="remix" className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="autoblog-source">Source article</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {sourceChars.toLocaleString("en-US")} / 60,000
                  </span>
                </div>
                <Textarea
                  id="autoblog-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  rows={10}
                  placeholder="Paste the full article here. Plain text or basic HTML both work."
                  maxLength={60_000}
                  disabled={isPending}
                  className="font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  The AI treats this as reference material and rewrites it in our voice — it won&apos;t copy
                  sentences verbatim, mention the source, or republish medical claims. Always review output
                  before publishing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="autoblog-source-url">
                    Source URL <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="autoblog-source-url"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://…"
                    maxLength={400}
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">For your records — never linked in the post.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoblog-focus">
                    Our angle <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="autoblog-focus"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="e.g. 'focus on receptor mechanism, skip dosing sections'"
                    maxLength={400}
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">What to emphasize, drop, or reframe.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="autoblog-keywords">Keywords <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="autoblog-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="GLP-1, satiety, incretin"
                maxLength={400}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">Comma-separated — woven in naturally.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoblog-audience">Audience <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="autoblog-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Experienced research-peptide buyers"
                maxLength={200}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">Who is this piece for?</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="autoblog-tone">Tone</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v as keyof typeof AUTOBLOG_TONES)}
                disabled={isPending}
              >
                <SelectTrigger id="autoblog-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUTOBLOG_TONES).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoblog-length">Length</Label>
              <Select
                value={length}
                onValueChange={(v) => setLength(v as keyof typeof AUTOBLOG_LENGTHS)}
                disabled={isPending}
              >
                <SelectTrigger id="autoblog-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUTOBLOG_LENGTHS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
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
              {mode === "topic"
                ? "Generated drafts are a starting point — review everything before publishing."
                : "Remixed drafts rewrite the source in our voice. Review carefully and fact-check before publishing."}
            </p>
            <Button type="button" onClick={handleGenerate} disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "topic" ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isPending
                ? mode === "topic"
                  ? "Generating…"
                  : "Remixing…"
                : mode === "topic"
                  ? "Generate draft"
                  : "Remix draft"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
