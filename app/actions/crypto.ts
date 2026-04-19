"use server"

import { createClient } from "@/lib/supabase/server"
import { createInvoice } from "@/lib/nowpayments"
import { headers } from "next/headers"

/**
 * Create (or reuse) a NOWPayments hosted invoice for an order.
 *
 * Called from the checkout page after the order row is created but before
 * the shopper pays. Returns the hosted `invoice_url` the client redirects to.
 *
 * We intentionally don't regenerate an invoice if one already exists for
 * this order — NOWPayments invoices are reusable until they expire and
 * generating a new one abandons the original payment window for the customer.
 */
export async function createCryptoInvoiceAction(input: {
  orderId: string
}): Promise<{ url?: string; error?: string }> {
  if (!input?.orderId) return { error: "Missing order id" }

  const supabase = await createClient()

  // Pull just the fields we need. RLS allows the customer to read their
  // own order by session (cookies) or email — that's enough for checkout.
  const { data: order, error: loadErr } = await supabase
    .from("orders")
    .select(
      "id, order_number, total, payment_status, payment_method, nowpayments_invoice_url, nowpayments_invoice_id",
    )
    .eq("id", input.orderId)
    .single()

  if (loadErr || !order) return { error: "Order not found" }
  if (order.payment_status === "paid") return { error: "Order already paid" }

  // Reuse the existing hosted URL if we've already minted one.
  if (order.nowpayments_invoice_url) {
    return { url: order.nowpayments_invoice_url }
  }

  // Build absolute return URLs — NOWPayments won't accept relative ones.
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`

  try {
    const invoice = await createInvoice({
      priceAmount: Number(order.total),
      priceCurrency: "usd",
      orderId: order.id,
      orderDescription: `PeptideXM order #${order.order_number}`,
      successUrl: `${origin}/checkout/success?order=${order.id}`,
      cancelUrl: `${origin}/checkout/cancel?order=${order.id}`,
      ipnCallbackUrl: `${origin}/api/nowpayments/ipn`,
    })

    // Persist so we can resume on refresh and so the IPN handler has a
    // known identifier to match against.
    const { error: persistErr } = await supabase
      .from("orders")
      .update({
        payment_method: "crypto",
        nowpayments_invoice_id: invoice.id,
        nowpayments_invoice_url: invoice.invoice_url,
        nowpayments_status: "waiting",
        nowpayments_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    if (persistErr) {
      console.error("[nowpayments] persist invoice error:", persistErr.message)
      // Still return the URL — the IPN will reconcile later via order_id.
    }

    return { url: invoice.invoice_url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[nowpayments] createInvoice error:", msg)
    // Surface the provider message in non-production so admins can
    // diagnose misconfigurations (unsupported ticker, wrong API key,
    // sandbox vs. production mismatch) without digging through logs.
    if (process.env.NODE_ENV !== "production") {
      return { error: `Crypto payment failed: ${msg}` }
    }
    return { error: "Could not start crypto payment. Please try again." }
  }
}
