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
        className={`fixed right-0 top-0 h-full w-full max-w-sm bg-background border-l border-border/50 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-accent" />
              <h2 className="font-serif text-2xl font-medium tracking-tight">Cart</h2>
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
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">Cart is empty</p>
                <p className="text-sm text-muted-foreground mb-6">Add items to get started</p>
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  asChild
                  className="w-full"
                >
                  <Link href="#products">Continue Shopping</Link>
                </Button>
              </div>
            ) : (
              <div className="px-4 py-5 space-y-3">
                {items.map(item => (
                  <div
                    key={`${item.id}-${item.variant}`}
                    className="group flex gap-4 bg-secondary/30 hover:bg-secondary/50 rounded-xl p-4 transition-colors duration-200 border border-border/20 hover:border-border/40"
                  >
                    {/* Image */}
                    <div className="relative w-24 h-24 bg-secondary rounded-lg flex-shrink-0 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="font-medium text-sm text-foreground line-clamp-2">
                          {item.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.variant}</p>
                        <p className="font-serif text-lg font-semibold text-foreground mt-2">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-3 bg-background rounded-lg w-fit p-1.5 border border-border/30">
                        <button
                          onClick={() => updateQuantity(item.id, item.variant, Math.max(1, item.quantity - 1))}
                          className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-semibold w-8 text-center text-foreground">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                          className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeItem(item.id, item.variant)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 hover:text-red-700 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-border/30 bg-secondary/20 p-5 space-y-4">
              {/* Pricing Details */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                  <span className="font-medium text-foreground">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                asChild
                className="w-full h-12 font-semibold shadow-lg hover:shadow-xl transition-shadow"
                onClick={onClose}
              >
                <Link href="/checkout">
                  Proceed to Checkout
                </Link>
              </Button>

              {/* Continue Shopping */}
              <Button
                variant="outline"
                className="w-full h-11"
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
