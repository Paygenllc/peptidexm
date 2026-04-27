"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Check } from "lucide-react"
import { saveChatBusinessHoursAction } from "@/app/admin/actions/chat-settings"

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

// Common IANA zones the operator is likely to pick from. Free-text
// input is still accepted (validated server-side via Intl) so this is
// just a quality-of-life shortcut, not a constraint.
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
  "Europe/London",
]

export function ChatHoursForm({
  initial,
}: {
  initial: {
    enabled: boolean
    timezone: string
    start: string
    end: string
    days: number[]
  }
}) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [days, setDays] = useState<Set<number>>(new Set(initial.days))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await saveChatBusinessHoursAction({
        enabled,
        timezone: timezone.trim(),
        start,
        end,
        days: Array.from(days),
      })
      if ("error" in res) {
        setError(res.error)
        return
      }
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
    })
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="chat-enabled" className="text-base font-medium">
              Use a schedule
            </Label>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              When off, the bubble always shows &ldquo;offline&rdquo; (phone
              required, 24-hour SLA). Use this for vacations or extended
              after-hours coverage.
            </p>
          </div>
          <Switch
            id="chat-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={pending}
          />
        </div>

        <fieldset
          disabled={!enabled || pending}
          className="space-y-5 disabled:opacity-50 transition-opacity"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chat-start">Open at</Label>
              <Input
                id="chat-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chat-end">Close at</Label>
              <Input
                id="chat-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Open days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const checked = days.has(d.value)
                return (
                  <label
                    key={d.value}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleDay(d.value)}
                    />
                    {d.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-tz">Timezone (IANA)</Label>
            <Input
              id="chat-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              list="chat-tz-suggestions"
              placeholder="America/New_York"
              required
            />
            <datalist id="chat-tz-suggestions">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Any IANA name works (e.g. &ldquo;Europe/Berlin&rdquo;). Validated
              when you save.
            </p>
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          {savedAt && (
            <span className="text-xs text-green-600 inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  )
}
