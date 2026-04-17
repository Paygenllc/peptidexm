'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from '@/lib/types'

export async function updateOrderStatus(orderId: string, status: string) {
  await requireAdmin()

  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    return { error: 'Invalid status' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)

  if (error) {
    console.error('[v0] updateOrderStatus error', error)
    return { error: error.message }
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true }
}

export async function updatePaymentStatus(orderId: string, paymentStatus: string) {
  await requireAdmin()

  if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
    return { error: 'Invalid payment status' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: paymentStatus })
    .eq('id', orderId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true }
}

export async function updateOrderTracking(
  orderId: string,
  data: { tracking_number?: string; tracking_carrier?: string; notes?: string }
) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      tracking_number: data.tracking_number || null,
      tracking_carrier: data.tracking_carrier || null,
      notes: data.notes || null,
    })
    .eq('id', orderId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true }
}

export async function deleteOrder(orderId: string) {
  await requireAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('orders').delete().eq('id', orderId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/orders')
  return { success: true }
}
