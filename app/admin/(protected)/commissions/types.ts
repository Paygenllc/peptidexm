/**
 * Types shared between the commissions server page and its
 * companion client. Kept in a tiny standalone file so the client
 * bundle doesn't drag in `requireAdmin` / Supabase imports just to
 * get the row shapes.
 */

/** One commission-earning redemption, fully resolved for display. */
export interface RedemptionRow {
  redemptionId: string
  orderId: string | null
  orderNumber: string | null
  orderStatus: string | null
  paymentStatus: string | null
  createdAt: string
  couponId: string
  couponCode: string
  affiliateName: string | null
  affiliateEmail: string | null
  commissionRatePercent: number
  /** Discount the customer received (cost to us). */
  amountOff: number
  /** Snapshot of cart subtotal when the coupon was applied. */
  subtotalAtRedemption: number
  /** subtotalAtRedemption − amountOff. The commissionable amount. */
  commissionableBase: number
  /** commissionableBase × commissionRatePercent / 100. */
  commission: number
  isPaid: boolean
}

/** Per-affiliate roll-up over the visible redemptions. */
export interface AffiliateRow {
  name: string
  email: string | null
  couponCodes: string[]
  redemptions: number
  totalDiscountGiven: number
  totalCommissionableBase: number
  totalCommission: number
}
