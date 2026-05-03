"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"
import type { CouponType } from "@/lib/coupons"

/**
 * Row shape returned to the admin UI. Snake_case matches the DB
 * columns 1:1 so the page can `.select("...")` and pass the result
 * straight through without a remap step. NUMERIC columns are coerced
 * to `number` at the boundary because Postgres returns them as
 * strings by default.
 *
 * `total_amount_off` is a derived sum of the row's redemptions —
 * not stored on the coupons table. We populate it via a left join
 * in `fetchCouponRow` / the page query so admin UI stats can show
 * a "total discount given" KPI without a separate roundtrip.
 */
export type AdminCouponRow = {
  id: string
  code: string
  type: CouponType
  value: number
  max_uses: number | null
  max_per_customer: number | null
  min_order_subtotal: number | null
  starts_at: string | null
  expires_at: string | null
  active: boolean
  customer_email: string | null
  source: string | null
  notes: string | null
  redemption_count: number
  total_amount_off: number
  created_at: string
  updated_at: string
}

/** The columns we always select for the admin table. */
const ROW_COLUMNS =
  "id, code, type, value, max_uses, max_per_customer, min_order_subtotal, starts_at, expires_at, active, customer_email, source, notes, redemption_count, created_at, updated_at"

/**
 * Convert a raw Supabase row + an optional total_amount_off aggregate
 * into the canonical AdminCouponRow shape. Centralizing the coercion
 * keeps the page, create, update, and toggle paths consistent.
 */
function toRow(
  raw: Record<string, unknown>,
  totalAmountOff = 0,
): AdminCouponRow {
  return {
    id: raw.id as string,
    code: raw.code as string,
    type: raw.type as CouponType,
    value: Number(raw.value),
    max_uses: (raw.max_uses as number | null) ?? null,
    max_per_customer: (raw.max_per_customer as number | null) ?? null,
    min_order_subtotal:
      raw.min_order_subtotal == null ? null : Number(raw.min_order_subtotal),
    starts_at: (raw.starts_at as string | null) ?? null,
    expires_at: (raw.expires_at as string | null) ?? null,
    active: raw.active as boolean,
    customer_email: (raw.customer_email as string | null) ?? null,
    source: (raw.source as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    redemption_count: Number(raw.redemption_count ?? 0),
    total_amount_off: Number(totalAmountOff ?? 0),
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}

/**
 * Refetch a single coupon and its total_amount_off so we can return
 * the freshly-mutated row to the client. Cheaper than re-querying the
 * whole list and lets the client patch its local state in place.
 */
async function fetchCouponRow(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<AdminCouponRow | null> {
  const { data, error } = await admin
    .from("coupons")
    .select(ROW_COLUMNS)
    .eq("id", id)
    .single()
  if (error || !data) {
    if (error) console.error("[v0] fetchCouponRow error:", error)
    return null
  }
  // Sum redemptions in a separate query — Supabase doesn't expose
  // arbitrary aggregations through PostgREST, but a single small
  // sum of NUMERIC over the row's own redemptions is fine.
  const { data: sumRows } = await admin
    .from("coupon_redemptions")
    .select("amount_off")
    .eq("coupon_id", id)
  const total =
    sumRows?.reduce((acc, r) => acc + Number(r.amount_off), 0) ?? 0
  return toRow(data as Record<string, unknown>, total)
}

interface CouponInput {
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

/**
 * Validate the shared input fields before either insert or update.
 * Returns null on success or an error string the client can render.
 */
function validateInput(input: CouponInput): string | null {
  if (!normalizeCode(input.code)) return "Code is required."
  if (!Number.isFinite(input.value) || input.value <= 0)
    return "Value must be greater than zero."
  if (input.type === "percent" && input.value > 100)
    return "Percent value cannot exceed 100."
  return null
}

/** Admin-side payload mapper from the client's camelCase → DB columns. */
function inputToRow(input: CouponInput) {
  return {
    code: normalizeCode(input.code),
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
  }
}

export async function createCouponAction(
  input: CouponInput,
): Promise<{ row?: AdminCouponRow; error?: string }> {
  await requireAdmin()
  const validation = validateInput(input)
  if (validation) return { error: validation }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("coupons")
    .insert({
      ...inputToRow(input),
      // Source `manual` distinguishes admin-authored codes from the
      // welcome codes minted by `issue_welcome_coupon` so reports can
      // segment by origin without parsing notes.
      source: "manual",
    })
    .select(ROW_COLUMNS)
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A coupon with that code already exists." }
    }
    console.error("[v0] createCoupon error:", error)
    return { error: error.message }
  }

  revalidatePath("/admin/coupons")
  // Newly-created coupons can't have redemptions yet, so total = 0.
  return { row: toRow(data as Record<string, unknown>, 0) }
}

export async function updateCouponAction(
  id: string,
  input: CouponInput,
): Promise<{ row?: AdminCouponRow; error?: string }> {
  await requireAdmin()
  const validation = validateInput(input)
  if (validation) return { error: validation }

  const admin = createAdminClient()
  const { error } = await admin
    .from("coupons")
    .update(inputToRow(input))
    .eq("id", id)

  if (error) {
    if (error.code === "23505")
      return { error: "Another coupon already uses that code." }
    console.error("[v0] updateCoupon error:", error)
    return { error: error.message }
  }

  revalidatePath("/admin/coupons")
  const row = await fetchCouponRow(admin, id)
  return row ? { row } : { error: "Coupon updated, but could not be reloaded." }
}

export async function toggleCouponActiveAction(
  id: string,
  active: boolean,
): Promise<{ row?: AdminCouponRow; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from("coupons").update({ active }).eq("id", id)
  if (error) {
    console.error("[v0] toggleCoupon error:", error)
    return { error: error.message }
  }
  revalidatePath("/admin/coupons")
  const row = await fetchCouponRow(admin, id)
  return row ? { row } : { error: "Coupon updated, but could not be reloaded." }
}

export async function deleteCouponAction(
  id: string,
): Promise<{
  softDeleted?: boolean
  row?: AdminCouponRow
  error?: string
}> {
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
    const row = await fetchCouponRow(admin, id)
    return row
      ? { softDeleted: true, row }
      : { error: "Coupon disabled, but could not be reloaded." }
  }

  const { error } = await admin.from("coupons").delete().eq("id", id)
  if (error) {
    console.error("[v0] deleteCoupon error:", error)
    return { error: error.message }
  }
  revalidatePath("/admin/coupons")
  return { softDeleted: false }
}
