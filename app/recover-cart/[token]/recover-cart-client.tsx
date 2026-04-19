"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCart, type CartItem } from "@/context/cart-context"
import type { AbandonedCartItemSnapshot } from "@/lib/abandoned-carts"

/**
 * Hydrates the client-side cart with the snapshot persisted server-side,
 * drops a hint in localStorage so the checkout form can pre-fill the
 * email field, then pushes the shopper to /checkout.
 *
 * Runs exactly once per mount (guarded by a ref) — without that, React
 * Strict Mode's double-invoke in dev would add each item twice.
 */
export function RecoverCartClient({
  items,
  email,
}: {
  items: AbandonedCartItemSnapshot[]
  email: string
}) {
  const { clearCart, addItem } = useCart()
  const router = useRouter()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    // Wipe whatever junk is in the client cart first — the email they
    // clicked represents the definitive set of items they wanted.
    clearCart()
    for (const i of items) {
      const cartItem: CartItem = {
        id: i.id,
        name: i.name,
        variant: i.variant,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
      }
      addItem(cartItem)
    }

    // Stash the email so /checkout can prefill its form. Scoped to this
    // session only so we don't leak between devices.
    if (typeof window !== "undefined" && email) {
      try {
        sessionStorage.setItem("peptidexm-recovered-email", email)
      } catch {
        // sessionStorage disabled in private tabs — fine to swallow.
      }
    }

    router.replace("/checkout")
  }, [items, email, clearCart, addItem, router])

  return null
}
