"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Compose and send a new outbound message. Wraps Resend and logs the
 * result (sent or failed) to `mail_messages` so the Outbox tab is a true
 * mirror of what actually went out.
 */
export async function sendMailMessageAction(_prev: unknown, formData: FormData) {
  const { user } = await requireAdmin()

  const to = String(formData.get("to") ?? "").trim().toLowerCase()
  const subject = String(formData.get("subject") ?? "").trim()
  const body = String(formData.get("body") ?? "").trim()
  const replyToId = String(formData.get("reply_to_id") ?? "").trim() || null

  if (!EMAIL_RE.test(to)) return { error: "Enter a valid recipient email." }
  if (!subject) return { error: "Subject is required." }
  if (!body) return { error: "Message body is required." }

  const supabase = await createClient()

  const { data: row, error: insertErr } = await supabase
    .from("mail_messages")
    .insert({
      direction: "outbound",
      from_email: process.env.EMAIL_FROM ?? "support@peptidexm.com",
      from_name: "PeptideXM",
      to_email: to,
      subject,
      body_text: body,
      body_html: textToHtml(body),
      reply_to_id: replyToId,
      status: "sent",
      sent_by: user.id,
    })
    .select("id")
    .single()

  if (insertErr || !row) {
    return { error: insertErr?.message ?? "Failed to queue message." }
  }

  const sendResult = await sendEmail({
    to,
    subject,
    text: body,
    html: textToHtml(body),
  })

  if ("error" in sendResult && sendResult.error) {
    await supabase
      .from("mail_messages")
      .update({
        status: "failed",
        error_message: String(sendResult.error).slice(0, 500),
      })
      .eq("id", row.id)
    return { error: "Send failed. The draft is in your outbox." }
  }

  if ("id" in sendResult && sendResult.id) {
    await supabase
      .from("mail_messages")
      .update({ resend_id: sendResult.id })
      .eq("id", row.id)
  }

  // If this was a reply, mark the original as read too — the admin just
  // handled it.
  if (replyToId) {
    await supabase
      .from("mail_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", replyToId)
      .is("read_at", null)
  }

  revalidatePath("/admin/inbox")
  revalidatePath("/admin/inbox/outbox")
  redirect(`/admin/inbox/${row.id}`)
}

export async function markReadAction(id: string, read: boolean) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase
    .from("mail_messages")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id)
  revalidatePath("/admin/inbox")
  revalidatePath(`/admin/inbox/${id}`)
}

export async function archiveMessageAction(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase
    .from("mail_messages")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/admin/inbox")
  redirect("/admin/inbox")
}

export async function deleteMessageAction(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from("mail_messages").delete().eq("id", id)
  revalidatePath("/admin/inbox")
  revalidatePath("/admin/inbox/outbox")
  redirect("/admin/inbox")
}

/** Minimal plain-text → HTML: preserve line breaks, autolink naked URLs. */
function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#8b5e34;">$1</a>',
  )
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.55;color:#111827;white-space:pre-wrap;">${linked}</div>`
}
