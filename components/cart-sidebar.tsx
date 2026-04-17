'use client'

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

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full bg-background">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-6 bg-background sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-accent" />
              <h2 className="font-serif text-3xl font-medium tracking-tight">Your Cart</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-all duration-200 hover:scale-110"
              aria-label="Close cart"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">Cart is empty</p>
                <p className="text-sm text-muted-foreground mb-6">Add items to get started</p>
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  asChild
                  className="w-full max-w-xs"
                >
                  <Link href="#products">Continue Shopping</Link>
                </Button>
              </div>
            ) : (
              <div className="px-6 py-6 space-y-4">
                {items.map(item => (
                  <div
                    key={`${item.id}-${item.variant}`}
                    className="group flex gap-5 bg-secondary rounded-2xl p-5 transition-all duration-200 border border-border hover:border-accent/50 hover:shadow-lg"
                  >
                    {/* Image - Larger and more prominent */}
                    <div className="relative w-32 h-32 bg-background rounded-xl flex-shrink-0 overflow-hidden border border-border/50 flex items-center justify-center">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-foreground line-clamp-2 mb-1">
                          {item.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3 font-medium">{item.variant}</p>
                        <p className="font-serif text-2xl font-bold text-accent">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          ${item.price.toFixed(2)} each
                        </p>
                      </div>

                      {/* Quantity Controls - More Prominent */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2 bg-background rounded-xl p-2 border border-border">
                          <button
                            onClick={() => updateQuantity(item.id, item.variant, Math.max(1, item.quantity - 1))}
                            className="p-2 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-200 font-bold"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-base font-bold w-8 text-center text-foreground">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                            className="p-2 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-200 font-bold"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Remove Button - Always Visible */}
                        <button
                          onClick={() => removeItem(item.id, item.variant)}
                          className="p-2.5 hover:bg-red-100 dark:hover:bg-red-950 text-red-600 hover:text-red-700 rounded-xl transition-all duration-200 font-bold"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-border bg-secondary/50 p-6 space-y-4 sticky bottom-0">
              {/* Pricing Details */}
              <div className="bg-background rounded-xl p-4 space-y-3 border border-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Items</span>
                  <span className="font-semibold text-foreground">{itemCount}</span>
                </div>
                <div className="border-t border-border/30 pt-3 flex justify-between items-center">
                  <span className="font-semibold text-foreground text-lg">Total</span>
                  <span className="font-serif text-3xl font-bold text-accent">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                asChild
                className="w-full h-14 font-bold text-base shadow-lg hover:shadow-xl transition-shadow"
                onClick={onClose}
              >
                <Link href="/checkout">
                  Proceed to Checkout
                </Link>
              </Button>

              {/* Continue Shopping */}
              <Button
                variant="outline"
                className="w-full h-12 font-semibold"
                onClick={onClose}
                asChild
              >
                <Link href="#products">Continue Shopping</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
