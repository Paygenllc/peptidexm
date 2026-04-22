'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Post-purchase CTA that renders one of two variants:
//   1. Guest buyer — "Create an account to track this order."
//      They get a styled call-to-action linking to /signup. When they
//      finish signing up, a DB trigger (`link_guest_orders_to_new_user`)
//      automatically back-links any existing guest orders that match
//      their email, so the order they just placed shows up on their
//      dashboard without any claim flow.
//   2. Signed-in buyer — "View your order in your account." Direct
//      link to the order detail page so they can come back to this
//      receipt any time without digging through email.
//
// Fetches auth state client-side because the checkout page is a
// client component (`'use client'`). Defaults to the guest variant
// during the brief pre-hydration window so returning shoppers who
// aren't signed in never see the "signed in" variant flash first.

interface Props {
  orderNumber?: string | null
}

export function PostPurchaseAccountCta({ orderNumber }: Props) {
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    // One-shot lookup — the shopper's auth state doesn't change
    // during the confirmation view, so we don't bother subscribing
    // to onAuthStateChange here.
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setIsSignedIn(!!data.user)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Skip the first render — avoids the "flash the guest CTA for
  // signed-in shoppers" problem. A fixed-height spacer preserves
  // layout so the confirmation panel doesn't jump when the real
  // CTA resolves a heartbeat later.
  if (isSignedIn === null) {
    return <div className="mt-8 h-[120px]" aria-hidden="true" />
  }

  if (isSignedIn && orderNumber) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-card p-5 text-left">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Track your order any time</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Your order is saved to your account. We&apos;ll add the carrier tracking number here
              the moment it ships.
            </p>
            <Link
              href={`/account/orders/${encodeURIComponent(orderNumber)}`}
              className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              View order details
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Guest variant — the main growth lever. A just-purchased shopper
  // is the single most valuable account-creation prospect we'll ever
  // see, so we give this CTA more visual weight than the generic
  // "Continue shopping" button underneath.
  return (
    <div className="mt-8 rounded-xl border-2 border-accent/30 bg-accent/5 p-5 text-left">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Create a free account to track this order</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            See real-time shipping updates, reorder in one click, and keep every receipt in one
            place. We&apos;ll automatically link this order to your new account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Create account
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
