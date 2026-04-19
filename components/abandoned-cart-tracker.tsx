"use client"

import { useEffect, useRef } from "react"
import type { CartItem } from "@/context/cart-context"

/**
 * Pings `/api/abandoned-cart/capture` whenever the shopper has typed a
 * plausible email and has items in cart. Debounced so we don't POST on
 * every keystroke, and memoized on a signature of
 * `email + itemCount + itemTotals` so we don't re-submit a cart that
 * hasn't meaningfully changed.
 *
 * Mounted once on /checkout — not the product pages — because (a) we
 * only get an email there and (b) it's the highest-intent step in the
 * funnel, so the captured "abandonment" signal is actually meaningful.
 */
export function AbandonedCartTracker({
  email,
  firstName,
  lastName,
  phone,
  items,
  userId,
}: {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  items: CartItem[]
  userId?: string | null
}) {
  // Track the last payload we posted so we can skip no-op updates.
  const lastSigRef = useRef<string>("")

  useEffect(() => {
    const trimmedEmail = email.trim()
    // Cheap client-side sanity filter. The server still validates.
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return
    if (!items || items.length === 0) return

    // Stable signature of the current capture-worthy state. Sorting by id
    // + variant keeps shuffles within the cart from triggering re-posts.
    const sig = JSON.stringify({
      e: trimmedEmail.toLowerCase(),
      f: firstName?.trim() || "",
      l: lastName?.trim() || "",
      p: phone?.trim() || "",
      i: [...items]
        .sort((a, b) => a.id - b.id || a.variant.localeCompare(b.variant))
        .map((i) => [i.id, i.variant, i.quantity, i.price]),
    })
    if (sig === lastSigRef.current) return

    // Debounce: only send once the user pauses for 1.5s. Covers both
    // "typing email" and "changing cart quantities" without hammering.
    const handle = window.setTimeout(() => {
      lastSigRef.current = sig
      // Fire-and-forget. Failures are non-fatal for the shopper — the
      // worst case is they don't get a reminder, which is strictly
      // better than a noisy error UI mid-checkout.
      fetch("/api/abandoned-cart/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          phone: phone?.trim() || null,
          userId: userId ?? null,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            variant: i.variant,
            price: i.price,
            quantity: i.quantity,
            image: i.image,
          })),
        }),
        keepalive: true,
      }).catch((err) => {
        console.log("[v0] abandoned-cart capture failed:", err)
      })
    }, 1500)

    return () => window.clearTimeout(handle)
  }, [email, firstName, lastName, phone, items, userId])

  return null
}
