"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"

/**
 * Mark a chat-bubble lead as replied (or back to "new") and stamp /
 * clear `replied_at`. We keep the column denormalized so the inbox
 * list query stays a simple `eq("status", "new")` head-count rather
 * than a join.
 *
 * The chat bubble feature is admin-internal: there's no customer-side
 * mutation path, so a single "set status" action covers the whole
 * lifecycle (new → replied → archived). Adding more states later is a
 * matter of widening the union, not redesigning this function.
 */
export async function setChatStatusAction(input: {
  id: string
  status: "new" | "replied" | "archived"
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  const admin = createAdminClient()
  const patch: Record<string, unknown> = { status: input.status }

  // Stamp `replied_at` when transitioning into "replied", clear it
  // when going back to "new" or "archived". This keeps reporting
  // honest if we ever add a "median time to first reply" metric.
  if (input.status === "replied") {
    patch.replied_at = new Date().toISOString()
  } else {
    patch.replied_at = null
  }

  const { error } = await admin
    .from("chat_messages")
    .update(patch)
    .eq("id", input.id)

  if (error) {
    console.error("[v0] setChatStatusAction error:", error.message)
    return { ok: false, error: error.message }
  }

  // Refresh the list, the detail, and the InboxTabs badge that lives
  // on every sibling tab.
  revalidatePath("/admin/inbox/chats")
  revalidatePath(`/admin/inbox/chats/${input.id}`)
  revalidatePath("/admin/inbox")
  return { ok: true }
}

/**
 * Save a free-form note on a chat lead. Used by the admin to record
 * follow-up context ("emailed back 11/05, no reply" etc.) without
 * leaving the inbox.
 */
export async function setChatNotesAction(input: {
  id: string
  notes: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  const admin = createAdminClient()
  // We store an empty string as NULL so the UI's "no notes yet"
  // empty-state stays accurate.
  const trimmed = input.notes.trim()
  const { error } = await admin
    .from("chat_messages")
    .update({ admin_notes: trimmed.length > 0 ? trimmed : null })
    .eq("id", input.id)

  if (error) {
    console.error("[v0] setChatNotesAction error:", error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath(`/admin/inbox/chats/${input.id}`)
  return { ok: true }
}
