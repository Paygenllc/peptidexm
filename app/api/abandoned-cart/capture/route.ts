import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateRecoveryToken } from "@/lib/abandoned-carts"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Captures (or refreshes) a shopper's in-progress cart so we can send a
 * recovery email if they leave without completing checkout.
 *
 * Called by the lightweight client tracker on the `/checkout` page once
 * the shopper has typed a valid-looking email and has items in cart.
 *
 * Design notes:
 * - `lower(email)` has a partial unique index WHERE recovered_at IS NULL,
 *   so we get one open abandoned cart per email. Using `upsert` with the
 *   business key lets us use this same endpoint for "new" and "refresh".
 * - We never read a user's session cookies here — this route serves guest
 *   and authenticated checkouts alike, so we pass an explicit `user_id`
 *   only when the client tells us one (checkout already has it).
 * - Writes are done with the service-role admin client because RLS on
 *   `abandoned_carts` has no public policies (intentional: PII lives here).
 */
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  // Cheap sanity check — full validation happens at order time. We just
  // want to avoid persisting obvious typos as "cart" rows.
  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const rawItems = Array.isArray(body?.items) ? body.items : []
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  // Normalize item shape so the DB blob stays predictable across captures
  // even if the client-side CartItem interface evolves.
  const items = rawItems
    .map((i: any) => ({
      id: Number(i?.id) || 0,
      name: String(i?.name ?? ""),
      variant: String(i?.variant ?? ""),
      price: Number(i?.price) || 0,
      quantity: Math.max(1, Math.min(999, Number(i?.quantity) || 1)),
      image: String(i?.image ?? ""),
    }))
    .filter((i) => i.id && i.name && i.price > 0)

  if (items.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 })
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() || null : null
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() || null : null
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : null
  const userId = typeof body?.userId === "string" ? body.userId : null

  const admin = createAdminClient()

  // See if an open cart already exists for this email so we can update it
  // without blowing away `reminder_count` (otherwise we'd spam shoppers
  // every time they hit "refresh" after an initial reminder was sent).
  const { data: existing, error: selErr } = await admin
    .from("abandoned_carts")
    .select("id, token, reminder_count")
    .ilike("email", email)
    .is("recovered_at", null)
    .maybeSingle()

  if (selErr) {
    console.log("[v0] abandoned-cart capture select error:", selErr)
    return NextResponse.json({ error: "Could not check cart" }, { status: 500 })
  }

  if (existing) {
    const { error: updErr } = await admin
      .from("abandoned_carts")
      .update({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        user_id: userId,
        items,
        subtotal,
        // updated_at refresh is handled by the table trigger.
      })
      .eq("id", existing.id)
    if (updErr) {
      console.log("[v0] abandoned-cart capture update error:", updErr)
      return NextResponse.json({ error: "Could not save cart" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: existing.id, token: existing.token })
  }

  const token = generateRecoveryToken()
  const { data: inserted, error: insErr } = await admin
    .from("abandoned_carts")
    .insert({
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      user_id: userId,
      token,
      items,
      subtotal,
    })
    .select("id, token")
    .single()

  if (insErr || !inserted) {
    console.log("[v0] abandoned-cart capture insert error:", insErr)
    return NextResponse.json({ error: "Could not save cart" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted.id, token: inserted.token })
}
