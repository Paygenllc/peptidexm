import { NextResponse } from "next/server"
import { recordInboundMessage } from "@/lib/mail-messages"

// Simple email regex — good enough to reject obvious garbage while still
// accepting the wide variety of addresses people actually use.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 })
  }

  const p = payload as Record<string, unknown>

  // Honeypot: legitimate clients never fill this field. Silently accept
  // to avoid telling bots they were caught.
  if (typeof p.website === "string" && p.website.trim() !== "") {
    return NextResponse.json({ ok: true })
  }

  const fromEmail = typeof p.email === "string" ? p.email.trim() : ""
  const fromName = typeof p.name === "string" ? p.name.trim() : ""
  const subject = typeof p.subject === "string" ? p.subject.trim() : ""
  const body = typeof p.message === "string" ? p.message.trim() : ""

  if (!EMAIL_RE.test(fromEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
  }
  if (body.length < 5) {
    return NextResponse.json({ error: "Please include a message." }, { status: 400 })
  }
  if (body.length > 10_000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 })
  }

  const result = await recordInboundMessage({
    fromEmail,
    fromName: fromName || null,
    subject: subject || "(no subject)",
    body,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.id, forwarded: result.forwarded })
}
