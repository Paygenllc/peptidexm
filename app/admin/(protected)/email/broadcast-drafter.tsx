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
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { generateBroadcastDraftAction, type BroadcastDraft } from "@/app/admin/actions/broadcasts"
import { AUTOBLOG_TONES } from "@/lib/autoblog-config"

/** Campaign goals — kept in sync with BROADCAST_GOAL_DIRECTIVES on the server. */
const GOALS = [
  { value: "announcement", label: "Announcement" },
  { value: "launch", label: "Product launch" },
  { value: "promotion", label: "Promotion / sale" },
  { value: "newsletter", label: "Newsletter roundup" },
  { value: "educational", label: "Educational" },
  { value: "reengagement", label: "Re-engagement" },
] as const

/**
 * Inline AI drafter the admin can collapse. Generates a full broadcast (subject,
 * preview text, markdown body) that the parent editor then fills in — nothing
 * is persisted until the admin clicks Save draft.
 */
export function BroadcastDrafter({
  onGenerated,
  disabled,
}: {
  onGenerated: (draft: BroadcastDraft) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [topic, setTopic] = useState("")
  const [keywords, setKeywords] = useState("")
  const [audience, setAudience] = useState("")
  const [goal, setGoal] = useState<(typeof GOALS)[number]["value"]>("newsletter")
  const [tone, setTone] = useState<keyof typeof AUTOBLOG_TONES>("conversational")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    setInfo(null)
    const trimmed = topic.trim()
    if (!trimmed) {
      setError("Describe what this email should be about.")
      return
    }

    const fd = new FormData()
    fd.set("topic", trimmed)
    fd.set("keywords", keywords.trim())
    fd.set("audience", audience.trim())
    fd.set("goal", goal)
    fd.set("tone", tone)

    startTransition(async () => {
      try {
        const result = await generateBroadcastDraftAction(fd)
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
          "Draft generated. Review the subject, preview, and body — edit anything before sending.",
        )
      } catch (err) {
        console.error("[v0] broadcast drafter failed:", err)
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
          <span className="font-medium text-foreground">AI drafter — generate an email from a brief</span>
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
            <Label htmlFor="drafter-topic">Brief</Label>
            <Textarea
              id="drafter-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={
                "e.g. 'Announce 15% off the XM-series metabolic line through Friday, include XM-S and XM-T' or 'Monthly newsletter — new arrivals, restock of BPC-157, and a link to the latest research post'"
              }
              maxLength={500}
              disabled={disabled || isPending}
            />
            <p className="text-xs text-muted-foreground">
              Be specific. The AI knows the full product catalog and can embed product cards.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="drafter-keywords">
                Keywords <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="drafter-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="free shipping, limited stock"
                maxLength={400}
                disabled={disabled || isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drafter-audience">
                Audience <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="drafter-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Repeat customers"
                maxLength={200}
                disabled={disabled || isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="drafter-goal">Goal</Label>
              <Select
                value={goal}
                onValueChange={(v) => setGoal(v as (typeof GOALS)[number]["value"])}
                disabled={disabled || isPending}
              >
                <SelectTrigger id="drafter-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="drafter-tone">Tone</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v as keyof typeof AUTOBLOG_TONES)}
                disabled={disabled || isPending}
              >
                <SelectTrigger id="drafter-tone">
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
              Generated drafts are a starting point — review before sending.
            </p>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={disabled || isPending}
              className="gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isPending ? "Generating…" : "Generate draft"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
