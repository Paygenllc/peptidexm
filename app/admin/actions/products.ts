'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

interface ProductUpdate {
  name?: string
  slug?: string
  description?: string | null
  category?: string | null
  image_url?: string | null
  purity?: string | null
  dosage?: string | null
  active?: boolean
  featured?: boolean
  sort_order?: number
}

export async function updateProduct(productId: string, data: ProductUpdate) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .update(data)
    .eq('id', productId)

  if (error) {
    console.error('[v0] updateProduct error', error)
    return { error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${productId}`)
  revalidatePath('/')
  return { success: true }
}

export async function createProduct(data: ProductUpdate & { name: string; slug: string }) {
  await requireAdmin()

  const supabase = await createClient()
  const { data: newProduct, error } = await supabase
    .from('products')
    .insert(data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { success: true, id: newProduct.id }
}

export async function deleteProduct(productId: string) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', productId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { success: true }
}

interface VariantUpdate {
  variant_name?: string
  price?: number
  stock?: number
  sku?: string | null
  sort_order?: number
}

export async function updateVariant(variantId: string, data: VariantUpdate) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('product_variants')
    .update(data)
    .eq('id', variantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { success: true }
}

export async function createVariant(
  productId: string,
  data: { variant_name: string; price: number; stock?: number; sku?: string | null; sort_order?: number }
) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('product_variants')
    .insert({ product_id: productId, ...data })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${productId}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteVariant(variantId: string) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { success: true }
}
