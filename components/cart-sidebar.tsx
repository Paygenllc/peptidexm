'use client'

import { useEffect } from 'react'
import { useCart } from '@/context/cart-context'
import { Button } from '@/components/ui/button'
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

interface CartSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart()

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`fixed right-0 top-0 h-[100dvh] w-full sm:max-w-md lg:max-w-lg bg-background sm:border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-4 bg-background shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-accent shrink-0" />
              <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight truncate">
                Your Cart
              </h2>
              {itemCount > 0 && (
                <span className="text-sm text-muted-foreground shrink-0">
                  ({itemCount})
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 hover:bg-secondary rounded-lg transition-colors h-10 w-10 flex items-center justify-center"
              aria-label="Close cart"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">Your cart is empty</p>
                <p className="text-sm text-muted-foreground mb-6">Add items to get started</p>
                <Button variant="outline" onClick={onClose} asChild className="w-full max-w-xs h-11">
                  <Link href="#products">Continue Shopping</Link>
                </Button>
              </div>
            ) : (
              <ul className="px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
                {items.map((item) => (
                  <li
                    key={`${item.id}-${item.variant}`}
                    className="flex gap-3 sm:gap-4 bg-secondary/60 rounded-xl p-3 sm:p-4 border border-border"
                  >
                    {/* Image */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-background rounded-lg shrink-0 overflow-hidden border border-border">
                      <img
                        src={item.image || '/placeholder.svg'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm sm:text-base text-foreground line-clamp-2 leading-snug">
                            {item.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                            {item.variant}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id, item.variant)}
                          className="p-1.5 -m-1.5 text-muted-foreground hover:text-destructive rounded-lg transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-end justify-between gap-2 mt-auto pt-2">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-0 bg-background rounded-lg border border-border h-9">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.variant, Math.max(1, item.quantity - 1))
                            }
                            className="h-9 w-9 flex items-center justify-center hover:bg-secondary rounded-l-lg transition-colors"
                            aria-label="Decrease quantity"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-sm font-semibold w-7 text-center text-foreground tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                            className="h-9 w-9 flex items-center justify-center hover:bg-secondary rounded-r-lg transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="font-serif text-lg sm:text-xl font-semibold text-foreground leading-none">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              ${item.price.toFixed(2)} each
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-border bg-background px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4 shrink-0 safe-pb">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-foreground">
                  ${total.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping and taxes calculated at checkout.
              </p>

              <Button asChild className="w-full h-12 font-semibold" onClick={onClose}>
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 text-sm"
                onClick={onClose}
                asChild
              >
                <Link href="#products">Continue Shopping</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
