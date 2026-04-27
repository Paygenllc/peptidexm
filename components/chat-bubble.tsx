"use client"

import { useEffect, useState } from "react"
import { MessageCircle, X, Send, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { submitChatAction } from "@/app/actions/submit-chat"

/**
 * Floating chat bubble. Two states matter:
 *
 *   open === true   — header copy reads "We're online. Usually reply
 *                     within minutes." Phone is optional. Message
 *                     gets sent immediately and the visitor sees a
 *                     friendly thank-you with no SLA promise.
 *   open === false  — header copy reads "We're offline. Leave your
 *                     details and we'll get back within 24 hours."
 *                     Phone is REQUIRED so we have a callback channel
 *                     even if the email reply gets caught in spam.
 *
 * The `open` flag comes from /api/chat/availability on mount; until
 * that resolves we render an optimistic "online" state because it's
 * the friendlier copy and any mistake is corrected as soon as the
 * fetch lands (typically <100ms).
 */
type Availability = { open: boolean; hoursLabel: string }

type FormState = {
  name: string
  email: string
  phone: string
  message: string
}

const INITIAL: FormState = { name: "", email: "", phone: "", message: "" }

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [availability, setAvailability] = useState<Availability>({
    open: true,
    hoursLabel: "",
  })
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch availability the first time the visitor opens the panel,
  // not on initial mount. That keeps the bubble fully off the
  // critical path on the first paint and avoids burning a request
  // for the ~95% of visitors who never click it.
  useEffect(() => {
    if (!isOpen || availability.hoursLabel) return
    let cancelled = false
    fetch("/api/chat/availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Availability) => {
        if (cancelled) return
        setAvailability({
          open: typeof data.open === "boolean" ? data.open : true,
          hoursLabel: typeof data.hoursLabel === "string" ? data.hoursLabel : "",
        })
      })
      .catch((err) => {
        // Fail open: keep the optimistic "online" state. The form
        // still works; only the header copy is wrong.
        console.log("[v0] chat-bubble: availability fetch failed", err)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, availability.hoursLabel])

  // Esc-to-close while the panel is open. We listen on document
  // because the panel doesn't get autofocus and listening on the
  // panel itself would miss key events fired before focus lands.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setIsOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, submitting])

  const phoneRequired = !availability.open
  const canSubmit =
    form.email.trim().length > 4 &&
    form.message.trim().length > 1 &&
    (!phoneRequired || form.phone.trim().length >= 5) &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await submitChatAction({
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        // Capture the page URL so the admin knows what the visitor
        // was looking at when they hit the bubble. Helpful for
        // intent: a question on a product page is usually about
        // that product.
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSubmitted(true)
      setForm(INITIAL)
    } catch (err) {
      console.error("[v0] chat-bubble submit threw", err)
      setError("Something went wrong. Please try again or email us directly.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Trigger — a circular brand-colored button pinned bottom-right.
        * Inset 4 on mobile, 6 on sm+ so it doesn't collide with the
        * cookie banner before the visitor accepts/rejects. The aria
        * label changes with state so screen readers can tell whether
        * pressing it will open or close the panel. */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((v) => !v)
          // Reset the thank-you state when the panel reopens, so the
          // visitor can submit a follow-up question without reloading.
          if (isOpen) setSubmitted(false)
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        aria-expanded={isOpen}
        className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-foreground/20 hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95"
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Panel. Slides up from bottom-right on open. We render the
        * full markup unconditionally and toggle visibility through
        * classes so the transition runs both directions. */}
      <div
        role="dialog"
        aria-label="Chat with us"
        aria-hidden={!isOpen}
        className={`fixed z-40 bottom-20 right-4 sm:bottom-24 sm:right-6 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-background border border-border shadow-2xl shadow-foreground/20 transition-all duration-200 ${
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                availability.open ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <h2 className="font-serif text-lg leading-none">
              {availability.open ? "We're online" : "We're offline"}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {availability.open ? (
              <>We usually reply within a few minutes. Drop a note below.</>
            ) : (
              <>
                Leave your email and phone — we&apos;ll get back within 24 hours.
                {availability.hoursLabel ? (
                  <>
                    {" "}
                    Live chat is open <span className="font-medium">{availability.hoursLabel}</span>.
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>

        {submitted ? (
          // Success state — keep it short and warm, and offer a path
          // back to the form so the visitor can send another message
          // without closing/reopening the bubble.
          <div className="px-5 py-8 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <Check className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-lg mb-1">Message sent</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {availability.open
                ? "We just got it. Expect a reply at the email you provided shortly."
                : "We'll be in touch within 24 hours at the email and phone you provided."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSubmitted(false)}
            >
              Send another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="chat-name" className="text-xs">
                Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="chat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={submitting}
                autoComplete="name"
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat-email" className="text-xs">
                Email <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="chat-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={submitting}
                autoComplete="email"
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat-phone" className="text-xs">
                Phone{" "}
                {phoneRequired ? (
                  <span aria-hidden="true">*</span>
                ) : (
                  <span className="text-muted-foreground">(optional)</span>
                )}
              </Label>
              <Input
                id="chat-phone"
                type="tel"
                required={phoneRequired}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={submitting}
                autoComplete="tel"
                maxLength={60}
                placeholder={phoneRequired ? "Required while we're offline" : "+1 555 555 5555"}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat-message" className="text-xs">
                How can we help? <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="chat-message"
                required
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                disabled={submitting}
                rows={3}
                maxLength={4000}
                className="text-sm resize-none"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 leading-relaxed"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={!canSubmit} className="w-full h-9 text-sm">
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Send message
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              We use your email and phone only to reply to your question. No marketing,
              no list-sharing.
            </p>
          </form>
        )}
      </div>
    </>
  )
}
