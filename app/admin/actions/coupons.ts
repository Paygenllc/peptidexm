"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import type { CouponType } from "@/lib/coupons"

/**
 * Admin coupon CRUD. Every action calls `requireAdmin()` first — the
 * underlying tables are RLS-protected to admin role, but defending in
 * depth here means a future RLS misconfiguration can't expose these
 * mutations to non-admin sessions through the server-action surface.
 *
 * Note we use `createAdminClient()` (service-role) for writes. The
 * `coupons` policies allow authenticated admins direct access, but
 * the abandoned-carts/orders modules established the precedent of
 * using the admin client from server actions for consistency, and
 * because the service-role bypass keeps operator UX snappy when
 * an auth session is mid-refresh.
 */

interface CreateCouponInput {
  code: string
  type: CouponType
  value: number
  maxUses?: number | null
  maxPerCustomer?: number | null
  minOrderSubtotal?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  customerEmail?: string | null
  notes?: string | null
  active: boolean
}

function normalizeCode(raw: string): string {
  // Coupon codes are case-insensitive at the DB layer (unique index on
  // upper(code)) but we store them upper-cased so the admin list
  // doesn't show a mix of casings. Strip whitespace + reject empty.
  return raw.trim().toUpperCase()
}

export async function createCouponAction(input: CreateCouponInput) {
  await requireAdmin()
  const code = normalizeCode(input.code)
  if (!code) return { error: "Code is required." }
  if (!Number.isFinite(input.value) || input.value <= 0)
    return { error: "Value must be greater than zero." }
  if (input.type === "percent" && input.value > 100)
    return { error: "Percent value cannot exceed 100." }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("coupons")
    .insert({
      code,
      type: input.type,
      value: input.value,
      max_uses: input.maxUses ?? null,
      max_per_customer: input.maxPerCustomer ?? null,
      min_order_subtotal: input.minOrderSubtotal ?? null,
      starts_at: input.startsAt || null,
      expires_at: input.expiresAt || null,
      customer_email: input.customerEmail?.trim().toLowerCase() || null,
      notes: input.notes?.trim() || null,
      active: input.active,
      // Source `manual` distinguishes admin-authored codes from the
      // welcome codes minted by `issue_welcome_coupon` so reports can
      // segment by origin without parsing notes.
      source: "manual",
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      // Unique violation on the case-insensitive code index.
      return { error: "A coupon with that code already exists." }
    }
    console.error("[v0] createCoupon error:", error)
    return { error: error.message }
  }

  revalidatePath("/admin/coupons")
  return { success: true, id: data.id }
}

interface UpdateCouponInput extends CreateCouponInput {
  id: string
}

export async function updateCouponAction(input: UpdateCouponInput) {
  await requireAdmin()
  const code = normalizeCode(input.code)
  if (!code) return { error: "Code is required." }
  if (!Number.isFinite(input.value) || input.value <= 0)
    return { error: "Value must be greater than zero." }
  if (input.type === "percent" && input.value > 100)
    return { error: "Percent value cannot exceed 100." }

  const admin = createAdminClient()
  const { error } = await admin
    .from("coupons")
    .update({
      code,
      type: input.type,
      value: input.value,
      max_uses: input.maxUses ?? null,
      max_per_customer: input.maxPerCustomer ?? null,
      min_order_subtotal: input.minOrderSubtotal ?? null,
      starts_at: input.startsAt || null,
      expires_at: input.expiresAt || null,
      customer_email: input.customerEmail?.trim().toLowerCase() || null,
      notes: input.notes?.trim() || null,
      active: input.active,
    })
    .eq("id", input.id)

  if (error) {
    if (error.code === "23505")
      return { error: "Another coupon already uses that code." }
    console.error("[v0] updateCoupon error:", error)
    return { error: error.message }
  }

  revalidatePath("/admin/coupons")
  return { success: true }
}

export async function toggleCouponActiveAction(id: string, active: boolean) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from("coupons")
    .update({ active })
    .eq("id", id)
  if (error) {
    console.error("[v0] toggleCoupon error:", error)
    return { error: error.message }
  }
  revalidatePath("/admin/coupons")
  return { success: true }
}

export async function deleteCouponAction(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  // We don't hard-delete coupons that have ever been redeemed —
  // doing so would null out the FK on real orders (`coupon_id` is
  // `on delete set null`) and confuse the audit trail. Instead, we
  // soft-disable by flipping `active=false`. For coupons with zero
  // redemptions, a hard delete is fine and keeps the list tidy.
  const { count, error: rErr } = await admin
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", id)
  if (rErr) {
    console.error("[v0] deleteCoupon redemption count error:", rErr)
    return { error: rErr.message }
  }

  if ((count ?? 0) > 0) {
    const { error } = await admin
      .from("coupons")
      .update({ active: false })
      .eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/coupons")
    return { success: true, archived: true }
  }

  const { error } = await admin.from("coupons").delete().eq("id", id)
  if (error) {
    console.error("[v0] deleteCoupon error:", error)
    return { error: error.message }
  }
  revalidatePath("/admin/coupons")
  return { success: true, archived: false }
}
