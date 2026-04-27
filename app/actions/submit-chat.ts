"use server"

import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { getChatAvailability } from "@/lib/chat-hours.server"
import { sendChatLeadEmail } from "@/lib/email"

/**
 * Public input shape for the chat bubble form. The server is the
 * source of truth for both validation rules and required-fields
 * logic — the client mirrors these but cannot be trusted.
 */
export type SubmitChatInput = {
  email: string
  message: string
  name?: string
  phone?: string
  pageUrl?: string
}

export type SubmitChatResult = { ok: true } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The "is the site open right now?" check is computed server-side
 * even though the bubble already knows — we don't trust the client
 * to label its own submission. This way the inbox tag is always
 * accurate even if someone tampers with the network call.
 *
 * Phone is required ONLY when we're offline. The whole point of the
 * offline path is to capture a callback channel, so we enforce it
 * server-side too. When online, phone stays optional.
 */
export async function submitChatAction(
  input: SubmitChatInput,
): Promise<SubmitChatResult> {
  const email = (input.email ?? "").trim()
  const message = (input.message ?? "").trim()
  const name = (input.name ?? "").trim()
  const phone = (input.phone ?? "").trim()
  const pageUrl = (input.pageUrl ?? "").trim()

  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." }
  if (message.length < 2) return { ok: false, error: "Please include a short message." }
  if (message.length > 4000) return { ok: false, error: "Message is too long (4000 characters max)." }
  if (email.length > 200) return { ok: false, error: "Email is too long." }
  if (name.length > 200) return { ok: false, error: "Name is too long." }
  if (phone.length > 60) return { ok: false, error: "Phone is too long." }

  const availability = await getChatAvailability()
  const submittedWhen: "online" | "offline" = availability.open ? "online" : "offline"

  if (submittedWhen === "offline" && phone.length < 5) {
    return {
      ok: false,
      error: "We're outside business hours — please leave a phone number too so we can reach you.",
    }
  }

  // Lightweight provenance for the admin: which page the bubble was
  // opened on, what client the visitor used. Both columns are nullable
  // so a missing header (e.g. server-side rendered without UA) just
  // stores null rather than blocking the insert.
  const hdrs = await headers()
  const userAgent = hdrs.get("user-agent")?.slice(0, 500) ?? null
  // Vercel sets x-forwarded-for; fall back to x-real-ip. Trim to the
  // first hop since the rest is just proxy chain noise.
  const fwd = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? null
  const ipAddress = fwd?.split(",")[0]?.trim().slice(0, 80) ?? null

  // RLS on chat_messages has no public INSERT policy, so we use the
  // service-role admin client. This is intentional — it means the
  // anon key alone cannot spam-fill the table; only this server
  // action can write. Combined with the validation above, that's
  // the floor of our anti-abuse story.
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("chat_messages")
    .insert({
      email,
      message,
      name: name || null,
      phone: phone || null,
      submitted_when: submittedWhen,
      page_url: pageUrl ? pageUrl.slice(0, 1000) : null,
      user_agent: userAgent,
      ip_address: ipAddress,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[v0] submitChatAction insert failed:", error.message)
    return { ok: false, error: "Couldn't save your message. Please try again or email us directly." }
  }

  // Best-effort admin notification. We do NOT fail the submission if
  // email delivery fails — the row is already saved and the admin
  // can find it in the inbox. Errors are logged for observability.
  try {
    await sendChatLeadEmail({
      id: data.id,
      email,
      name: name || null,
      phone: phone || null,
      message,
      submittedWhen,
      pageUrl: pageUrl || null,
    })
  } catch (err) {
    console.error("[v0] submitChatAction email failed (non-fatal):", err)
  }

  return { ok: true }
}
