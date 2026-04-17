'use client'

import { useCart } from '@/context/cart-context'
import { Button } from '@/components/ui/button'
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface CartSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart()

  return (
    <>
      {/* Full-Screen Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Full-Page Cart Modal */}
      <div
        className={`fixed inset-0 z-50 overflow-y-auto transition-all duration-300 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="min-h-screen bg-background flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border/30 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-8 w-8 text-accent" />
                <h1 className="font-serif text-4xl font-bold tracking-tight">Shopping Cart</h1>
              </div>
              <button
                onClick={onClose}
                className="p-3 hover:bg-secondary rounded-xl transition-all duration-200 hover:scale-110"
                aria-label="Close cart"
              >
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-foreground mb-3">Cart is Empty</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md text-center">
                  Add premium research peptides to your cart and we&apos;ll have them ready for you.
                </p>
                <Button 
                  size="lg"
                  onClick={onClose} 
                  asChild
                  className="gap-2"
                >
                  <Link href="#products">
                    Continue Shopping
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  {items.map(item => (
                    <div
                      key={`${item.id}-${item.variant}`}
                      className="group bg-secondary rounded-2xl border border-border hover:border-accent/50 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col"
                    >
                      {/* Product Image */}
                      <div className="relative w-full aspect-square bg-background overflow-hidden flex items-center justify-center border-b border-border">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="p-6 space-y-4 flex flex-col flex-1">
                        {/* Name and Details */}
                        <div>
                          <h3 className="font-serif text-lg font-bold text-foreground mb-2 line-clamp-2">
                            {item.name}
                          </h3>
                          <p className="text-sm font-semibold text-accent mb-1">{item.variant}</p>
                          <p className="text-sm text-muted-foreground">
                            ${item.price.toFixed(2)} each
                          </p>
                        </div>

                        {/* Total Price */}
                        <div className="bg-background rounded-xl p-3 border border-border/50">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Subtotal</span>
                            <span className="font-serif text-2xl font-bold text-accent">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls & Remove */}
                        <div className="flex items-center gap-3 mt-auto pt-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center bg-background border border-border rounded-xl p-1 flex-1">
                            <button
                              onClick={() => updateQuantity(item.id, item.variant, Math.max(1, item.quantity - 1))}
                              className="p-2 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-200 flex-1 flex items-center justify-center"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-5 w-5 font-bold" />
                            </button>
                            <span className="text-lg font-bold w-10 text-center text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                              className="p-2 hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-200 flex-1 flex items-center justify-center"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-5 w-5 font-bold" />
                            </button>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => removeItem(item.id, item.variant)}
                            className="p-3 hover:bg-red-100 dark:hover:bg-red-950 text-red-600 hover:text-red-700 rounded-xl transition-all duration-200"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Footer */}
                <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-8">
                  <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      {/* Items Count */}
                      <div className="bg-secondary rounded-2xl p-6 border border-border/50 hover:border-accent/30 transition-all">
                        <p className="text-sm text-muted-foreground mb-2">Total Items</p>
                        <p className="font-serif text-4xl font-bold text-foreground">{itemCount}</p>
                      </div>

                      {/* Subtotal */}
                      <div className="bg-secondary rounded-2xl p-6 border border-border/50 hover:border-accent/30 transition-all">
                        <p className="text-sm text-muted-foreground mb-2">Subtotal</p>
                        <p className="font-serif text-4xl font-bold text-accent">${total.toFixed(2)}</p>
                      </div>

                      {/* Actions */}
                      <div className="space-y-3">
                        <Button
                          asChild
                          className="w-full h-14 font-bold text-base shadow-lg hover:shadow-xl transition-shadow"
                          onClick={onClose}
                        >
                          <Link href="/checkout" className="flex items-center justify-center gap-2">
                            Proceed to Checkout
                            <ArrowRight className="h-5 w-5" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full h-12 font-semibold"
                          onClick={onClose}
                          asChild
                        >
                          <Link href="#products">Continue Shopping</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
