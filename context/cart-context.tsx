'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export interface CartItem {
  id: number
  name: string
  variant: string
  price: number
  quantity: number
  image: string
}

export interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: number, variant: string) => void
  updateQuantity: (id: number, variant: string, quantity: number) => void
  clearCart: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'peptidexm-cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CART_STORAGE_KEY)
      if (saved) {
        try {
          setItems(JSON.parse(saved))
        } catch (e) {
          console.error('[v0] Failed to parse cart from localStorage', e)
          setItems([])
        }
      }
      setIsLoaded(true)
    }
  }, [])

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    }
  }, [items, isLoaded])

  const addItem = (newItem: CartItem) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(
        item => item.id === newItem.id && item.variant === newItem.variant
      )

      if (existingItem) {
        return prevItems.map(item =>
          item.id === newItem.id && item.variant === newItem.variant
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        )
      }

      return [...prevItems, newItem]
    })
  }

  const removeItem = (id: number, variant: string) => {
    setItems(prevItems => prevItems.filter(item => !(item.id === id && item.variant === variant)))
  }

  const updateQuantity = (id: number, variant: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id, variant)
      return
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id && item.variant === variant
          ? { ...item, quantity }
          : item
      )
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
