'use server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Generate a Squadco payment link for card payments.
 *
 * Squadco handles all PCI compliance — we never touch card data. The link
 * is pre-filled with the order amount and a reference ID, and the customer
 * completes payment on Squadco's hosted page. The webhook verifies completion
 * and marks the order as paid before we fulfill it.
 *
 * Per Squadco API docs, payment links require:
 *  - amount: in smallest currency unit (cents for USD, kobo for NGN)
 *  - currency: 'USD', 'NGN', etc.
 *  - customer_email: used for receipts and lookup
 *  - customer_name: optional but improves UX
 *  - reference: unique order identifier for idempotency
 *  - redirect_url: where to send the customer after payment
 *  - metadata: arbitrary JSON for your records
 */
export async function generateSquadcoPaymentLinkAction(input: {
  orderNumber: string
  amountCents: number
  email: string
  firstName: string
  lastName: string
  redirectUrl: string
}): Promise<{ url: string } | { error: string }> {
  const apiKey = process.env.SQUADCO_API_KEY
  if (!apiKey) {
    console.error('[v0] SQUADCO_API_KEY not set')
    return { error: 'Payment service not configured. Contact support.' }
  }

  const {
    orderNumber,
    amountCents,
    email,
    firstName,
    lastName,
    redirectUrl,
  } = input

  try {
    // Squadco payment link creation endpoint.
    // Docs: https://docs.squadco.com/Payments/Payment-Links
    const response = await fetch('https://api.squadco.com/v1/payment_links/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Squadco expects amounts in the smallest unit: cents for USD,
        // kobo for NGN, etc. Pass as integer.
        amount: amountCents,
        currency: 'USD', // Adjust if supporting other currencies
        // Customer identifiers — used for receipts and lookup
        customer_email: email,
        customer_name: `${firstName} ${lastName}`,
        // Unique reference tied to this order; prevents duplicates if
        // the request is retried. Must be idempotent.
        reference: `order-${orderNumber}`,
        // Where to send the customer after payment completion
        redirect_url: redirectUrl,
        // Metadata for our records — order context that doesn't affect
        // the payment but helps with lookups and reconciliation
        metadata: {
          order_number: orderNumber,
          customer_email: email,
          created_at: new Date().toISOString(),
        },
      }),
    })

    const responseText = await response.text()
    console.log('[v0] Squadco API request:')
    console.log('[v0]   Endpoint: https://api.squadco.com/v1/payment_links/')
    console.log('[v0]   Method: POST')
    console.log('[v0]   Auth: Bearer token present =', !!apiKey)
    console.log('[v0]   API Key length:', apiKey?.length || 0)
    console.log('[v0]   Response status:', response.status, response.statusText)
    console.log('[v0]   Response headers:', {
      'content-type': response.headers.get('content-type'),
      'x-request-id': response.headers.get('x-request-id'),
    })
    console.log('[v0]   Response body (first 1000 chars):', responseText.slice(0, 1000))

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText)
        console.error('[v0] Squadco error response:', JSON.stringify(errorData, null, 2))
      } catch {
        console.error('[v0] Squadco error (non-JSON):', responseText)
      }
      
      // 403 typically means auth issue or insufficient permissions
      if (response.status === 403) {
        return {
          error: 'Authentication failed with payment provider. Please verify your API key and try again.',
        }
      }
      
      return {
        error: `Payment service error (${response.status}). Please try again or contact support.`,
      }
    }

    let data: unknown
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('[v0] Failed to parse Squadco response as JSON')
      return { error: 'Invalid response from payment service. Please try again.' }
    }

    // Squadco response structure can vary; try multiple possible paths
    const paymentUrl =
      (data as any)?.data?.payment_link ||
      (data as any)?.data?.link ||
      (data as any)?.payment_link ||
      (data as any)?.link ||
      (data as any)?.url ||
      null

    if (!paymentUrl) {
      console.error('[v0] Squadco response missing payment link:', data)
      return { error: 'Payment link generation failed. Please try again.' }
    }

    console.log('[v0] Payment link generated successfully')
    return { url: paymentUrl }
  } catch (err) {
    console.error('[v0] generateSquadcoPaymentLink exception:', err)
    return {
      error: 'Network error creating payment link. Please check your connection and try again.',
    }
  }
}
