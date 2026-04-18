export type OrderStatus =
  | 'processing'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export const ORDER_STATUSES: OrderStatus[] = [
  'processing',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'refunded',
]

export interface ProductVariant {
  id: string
  product_id: string
  variant_name: string
  price: number
  stock: number
  sku: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  purity: string | null
  dosage: string | null
  active: boolean
  featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
  product_variants?: ProductVariant[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  product_name: string
  variant_name: string
  image_url: string | null
  unit_price: number
  quantity: number
  line_total: number
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  payment_status: PaymentStatus
  email: string
  phone: string | null
  first_name: string
  last_name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip_code: string
  country: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  tracking_number: string | null
  tracking_carrier: string | null
  notes: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
}

export interface OrderStatusHistoryEntry {
  id: string
  order_id: string
  status: OrderStatus
  notes: string | null
  changed_by: string | null
  created_at: string
}
