import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

/**
 * Increment a blog post's view_count.
 *
 * - Admin sessions are excluded — we don't want editors inflating their own
 *   numbers every time they proofread a post.
 * - We drop a short-lived dedupe cookie (`pxm_blog_v_<slug>`, 12 hours) so
 *   the same viewer reloading the page doesn't keep bumping the counter.
 *   The client-side `BlogViewBeacon` already session-dedupes; this adds a
 *   second belt-and-braces check on the server.
 * - The actual update happens via the `increment_blog_view` SECURITY DEFINER
 *   RPC so we don't need to relax RLS on blog_posts UPDATE for anon users.
 */
export const dynamic = "force-dynamic"

const DEDUPE_TTL_SECONDS = 60 * 60 * 12 // 12 hours

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  if (!slug || slug.length > 200) {
    return NextResponse.json({ ok: false, reason: "bad_slug" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Skip admins — their browsing shouldn't register as organic reader traffic.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.is_admin) return NextResponse.json({ ok: true, skipped: "admin" })
  }

  // Per-(slug, viewer) dedupe via cookie.
  const cookieStore = await cookies()
  const cookieName = `pxm_blog_v_${slug}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64)
  if (cookieStore.get(cookieName)) {
    return NextResponse.json({ ok: true, skipped: "recent" })
  }

  const { error } = await supabase.rpc("increment_blog_view", { p_slug: slug })
  if (error) {
    console.log("[v0] blog view increment failed", error)
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
  }

  cookieStore.set({
    name: cookieName,
    value: "1",
    path: "/",
    maxAge: DEDUPE_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  })

  return NextResponse.json({ ok: true })
}
