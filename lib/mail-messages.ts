import "server-only"

import { createClient } from "@/lib/supabase/server"
import { CONTACT_EMAIL } from "@/lib/contact"
import { sendEmail } from "@/lib/email"

/**
 * Record an inbound contact-form submission and forward a copy to the
 * catch-all support inbox (peptidexm@gmail.com by default). The insert is
 * authoritative — we always keep the row so nothing is lost if the forward
 * fails — and the Resend call is best-effort.
 *
 * `reply-to` is set to the sender's address so an admin can just hit Reply
 * in Gmail and the response goes to the customer.
 */
export async function recordInboundMessage(input: {
  fromEmail: string
  fromName?: string | null
  subject: string
  body: string
}) {
  const supabase = await createClient()
  const fromEmail = input.fromEmail.trim().toLowerCase()
  const fromName = input.fromName?.trim() || null
  const subject = input.subject.trim() || "(no subject)"
  const body = input.body.trim()

  if (!fromEmail || !body) {
    return { ok: false as const, error: "Missing from address or body" }
  }

  const { data: row, error } = await supabase
    .from("mail_messages")
    .insert({
      direction: "inbound",
      from_email: fromEmail,
      from_name: fromName,
      to_email: CONTACT_EMAIL,
      subject,
      body_text: body,
      body_html: null,
      status: "received",
    })
    .select("id")
    .single()

  if (error || !row) {
    console.error("[inbox] failed to record inbound message:", error)
    return { ok: false as const, error: error?.message ?? "insert failed" }
  }

  // Forward to the support inbox. Keep the original sender in From-ish
  // fields so an admin scanning Gmail sees who wrote in, and set reply-to
  // so hitting Reply in Gmail writes back to the customer.
  const forwardHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">
    New contact form submission via peptidexm.com
  </p>
  <table style="border-collapse:collapse;margin:0 0 16px 0;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">From:</td><td style="padding:4px 0;">${escapeHtml(fromName ?? fromEmail)} &lt;${escapeHtml(fromEmail)}&gt;</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Subject:</td><td style="padding:4px 0;">${escapeHtml(subject)}</td></tr>
  </table>
  <div style="white-space:pre-wrap;border-left:3px solid #8b5e34;padding:8px 12px;background:#faf8f5;font-size:14px;line-height:1.5;">${escapeHtml(body)}</div>
  <p style="margin:16px 0 0 0;color:#6b7280;font-size:12px;">
    Reply directly to this email to respond to the customer. A copy is also saved in the admin inbox.
  </p>
</div>`.trim()

  const forwardText = `New contact form submission via peptidexm.com

From: ${fromName ?? fromEmail} <${fromEmail}>
Subject: ${subject}

${body}

---
Reply directly to this email to respond to the customer.`

  const sendResult = await sendEmail({
    to: CONTACT_EMAIL,
    subject: `[Contact] ${subject}`,
    html: forwardHtml,
    text: forwardText,
    replyTo: fromEmail,
  })

  if ("error" in sendResult && sendResult.error) {
    // Best-effort: record the forward failure but still consider the
    // submission itself successful — the row lives in the inbox.
    await supabase
      .from("mail_messages")
      .update({
        status: "received",
        error_message: `forward failed: ${String(sendResult.error).slice(0, 500)}`,
      })
      .eq("id", row.id)
    return { ok: true as const, id: row.id, forwarded: false as const }
  }

  if ("skipped" in sendResult && sendResult.skipped) {
    // No Resend key configured — inbox row still exists.
    return { ok: true as const, id: row.id, forwarded: false as const }
  }

  await supabase
    .from("mail_messages")
    .update({ status: "forwarded" })
    .eq("id", row.id)

  return { ok: true as const, id: row.id, forwarded: true as const }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
