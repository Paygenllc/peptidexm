"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { revalidatePath } from "next/cache"

interface VariantInput {
  id?: string
  variant_name: string
  price: number
  stock: number
  sku: string | null
  sort_order: number
}

interface ProductInput {
  id?: string
  slug: string
  name: string
  description: string
  category: string
  image_url: string
  purity: string
  dosage: string
  active: boolean
  featured: boolean
  sort_order: number
  variants: VariantInput[]
}

export async function saveProductAction(input: ProductInput) {
  await requireAdmin()

  if (!input.name.trim()) return { error: "Name is required" }
  if (!input.slug.trim()) return { error: "Slug is required" }

  const supabase = await createClient()

  const productData = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    description: input.description.trim() || null,
    category: input.category.trim() || null,
    image_url: input.image_url.trim() || null,
    purity: input.purity.trim() || null,
    dosage: input.dosage.trim() || null,
    active: input.active,
    featured: input.featured,
    sort_order: input.sort_order,
  }

  let productId = input.id

  if (productId) {
    const { error } = await supabase.from("products").update(productData).eq("id", productId)
    if (error) {
      console.error("[v0] product update error", error)
      return { error: error.message }
    }
  } else {
    const { data: created, error } = await supabase.from("products").insert(productData).select("id").single()
    if (error) {
      console.error("[v0] product create error", error)
      return { error: error.message }
    }
    productId = created.id
  }

  if (!productId) return { error: "Product id not available" }

  // Handle variants - upsert existing, insert new, delete removed
  const { data: existingVariants } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)

  const keepIds = input.variants.filter((v) => v.id).map((v) => v.id as string)
  const toDelete = (existingVariants ?? []).filter((v) => !keepIds.includes(v.id)).map((v) => v.id)

  if (toDelete.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", toDelete)
    if (error) return { error: error.message }
  }

  for (const v of input.variants) {
    if (!v.variant_name.trim()) continue
    const variantRow = {
      product_id: productId,
      variant_name: v.variant_name.trim(),
      price: v.price,
      stock: v.stock,
      sku: v.sku?.trim() || null,
      sort_order: v.sort_order,
    }
    if (v.id) {
      const { error } = await supabase.from("product_variants").update(variantRow).eq("id", v.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from("product_variants").insert(variantRow)
      if (error) return { error: error.message }
    }
  }

  // Invalidate every storefront surface that reads product data so
  // admin edits show up instantly. The product detail route is a
  // dynamic segment, so we revalidate the specific slug and the
  // layout root to cover the grid, detail pages, and the public
  // JSON endpoint (which client components pull via SWR).
  revalidatePath("/admin/products")
  revalidatePath(`/admin/products/${productId}`)
  revalidatePath("/", "layout")
  revalidatePath(`/products/${input.slug}`, "page")
  revalidatePath("/api/products")

  return { success: true, id: productId }
}

export async function deleteProductAction(productId: string) {
  await requireAdmin()

  const supabase = await createClient()
  // Fetch the slug first so we can narrow the detail-page revalidate
  // after the row is gone — if we read it after delete we'd get null.
  const { data: existing } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle()

  const { error } = await supabase.from("products").delete().eq("id", productId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/products")
  revalidatePath("/", "layout")
  if (existing?.slug) revalidatePath(`/products/${existing.slug}`, "page")
  revalidatePath("/api/products")
  return { success: true }
}

export async function toggleProductActiveAction(productId: string, active: boolean) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from("products").update({ active }).eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath("/admin/products")
  revalidatePath("/", "layout")
  revalidatePath("/api/products")
  return { success: true }
}
