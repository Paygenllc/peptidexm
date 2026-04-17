'use client'

import { useState } from 'react'
import { useCart } from '@/context/cart-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface CustomerInfo {
  email: string
  phone: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const [step, setStep] = useState<'cart' | 'info' | 'summary' | 'success'>('cart')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isProcessing, setIsProcessing] = useState(false)

  const validateInfo = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!customerInfo.email || !customerInfo.email.includes('@')) {
      newErrors.email = 'Valid email is required'
    }
    if (!customerInfo.phone || customerInfo.phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Valid phone number is required'
    }
    if (!customerInfo.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!customerInfo.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!customerInfo.address.trim()) {
      newErrors.address = 'Address is required'
    }
    if (!customerInfo.city.trim()) {
      newErrors.city = 'City is required'
    }
    if (!customerInfo.state.trim()) {
      newErrors.state = 'State/Province is required'
    }
    if (!customerInfo.zipCode.trim()) {
      newErrors.zipCode = 'ZIP/Postal code is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinueToInfo = () => {
    setStep('info')
  }

  const handleContinueToSummary = () => {
    if (validateInfo()) {
      setStep('summary')
    }
  }

  const handlePlaceOrder = async () => {
    setIsProcessing(true)
    // Simulate payment processing
    setTimeout(() => {
      // Save order to localStorage for demonstration
      const order = {
        id: `ORDER-${Date.now()}`,
        date: new Date().toISOString(),
        items,
        total,
        customerInfo,
      }
      localStorage.setItem('last-order', JSON.stringify(order))
      
      setIsProcessing(false)
      setStep('success')
      clearCart()
    }, 2000)
  }

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="min-h-screen bg-secondary/30 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center py-24">
            <h1 className="font-serif text-4xl font-medium mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">Add some peptides to get started</p>
            <Button asChild>
              <Link href="/">Back to Store</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-12">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Success Page */}
        {step === 'success' && (
          <div className="text-center py-24">
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h1 className="font-serif text-4xl font-medium mb-4">Order Placed Successfully!</h1>
            <p className="text-muted-foreground mb-2">Thank you for your order</p>
            <p className="text-muted-foreground mb-8">
              A confirmation email has been sent to <span className="font-medium">{customerInfo.email}</span>
            </p>
            <Button asChild size="lg">
              <Link href="/">Return to Store</Link>
            </Button>
          </div>
        )}

        {/* Checkout Steps */}
        {step !== 'success' && (
          <>
            {/* Header */}
            <div className="mb-8">
              <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Store
              </Link>

              <h1 className="font-serif text-4xl font-medium mb-4">Checkout</h1>

              {/* Step Indicator */}
              <div className="flex gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'cart' || step === 'info' || step === 'summary' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
                  <span className="text-sm font-medium">1. Cart Review</span>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'info' || step === 'summary' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
                  <span className="text-sm font-medium">2. Shipping Info</span>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'summary' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
                  <span className="text-sm font-medium">3. Order Summary</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                {/* Step 1: Cart Review */}
                {step === 'cart' && (
                  <Card className="border-border/50">
                    <CardContent className="p-8">
                      <h2 className="font-serif text-2xl font-medium mb-6">Cart Review</h2>
                      <div className="space-y-4 mb-8">
                        {items.map(item => (
                          <div key={`${item.id}-${item.variant}`} className="flex gap-4 pb-4 border-b border-border last:border-0">
                            <div className="w-20 h-20 bg-secondary/50 rounded flex-shrink-0">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover rounded"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-foreground">{item.name}</h3>
                              <p className="text-sm text-muted-foreground">{item.variant}</p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-sm text-muted-foreground">Qty: {item.quantity}</span>
                                <span className="font-serif font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button onClick={handleContinueToInfo} className="w-full h-12">
                        Continue to Shipping Info
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Customer Info */}
                {step === 'info' && (
                  <Card className="border-border/50">
                    <CardContent className="p-8">
                      <h2 className="font-serif text-2xl font-medium mb-6">Shipping Information</h2>

                      <form className="space-y-6">
                        {/* Email and Phone */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              Email Address *
                            </label>
                            <input
                              type="email"
                              value={customerInfo.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.email ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="john@example.com"
                            />
                            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              Phone Number *
                            </label>
                            <input
                              type="tel"
                              value={customerInfo.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.phone ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="(555) 123-4567"
                            />
                            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
                          </div>
                        </div>

                        {/* Name */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              First Name *
                            </label>
                            <input
                              type="text"
                              value={customerInfo.firstName}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.firstName ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="John"
                            />
                            {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>}
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              Last Name *
                            </label>
                            <input
                              type="text"
                              value={customerInfo.lastName}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.lastName ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="Doe"
                            />
                            {errors.lastName && <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>}
                          </div>
                        </div>

                        {/* Address */}
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-2">
                            Address *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                              errors.address ? 'border-red-500' : 'border-border'
                            }`}
                            placeholder="123 Main Street"
                          />
                          {errors.address && <p className="text-red-600 text-sm mt-1">{errors.address}</p>}
                        </div>

                        {/* City, State, ZIP */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              City *
                            </label>
                            <input
                              type="text"
                              value={customerInfo.city}
                              onChange={(e) => handleInputChange('city', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.city ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="New York"
                            />
                            {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city}</p>}
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              State/Province *
                            </label>
                            <input
                              type="text"
                              value={customerInfo.state}
                              onChange={(e) => handleInputChange('state', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.state ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="NY"
                            />
                            {errors.state && <p className="text-red-600 text-sm mt-1">{errors.state}</p>}
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground block mb-2">
                              ZIP/Postal Code *
                            </label>
                            <input
                              type="text"
                              value={customerInfo.zipCode}
                              onChange={(e) => handleInputChange('zipCode', e.target.value)}
                              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
                                errors.zipCode ? 'border-red-500' : 'border-border'
                              }`}
                              placeholder="10001"
                            />
                            {errors.zipCode && <p className="text-red-600 text-sm mt-1">{errors.zipCode}</p>}
                          </div>
                        </div>

                        {/* Country */}
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-2">
                            Country *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                            placeholder="United States"
                          />
                        </div>
                      </form>

                      <div className="flex gap-4 mt-8">
                        <Button variant="outline" onClick={() => setStep('cart')} className="h-12">
                          Back to Cart
                        </Button>
                        <Button onClick={handleContinueToSummary} className="flex-1 h-12">
                          Continue to Summary
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Step 3: Order Summary */}
                {step === 'summary' && (
                  <Card className="border-border/50">
                    <CardContent className="p-8">
                      <h2 className="font-serif text-2xl font-medium mb-6">Order Summary</h2>

                      {/* Shipping Info */}
                      <div className="mb-8 pb-8 border-b border-border">
                        <h3 className="font-medium text-foreground mb-4">Shipping Address</h3>
                        <p className="text-sm text-foreground">
                          {customerInfo.firstName} {customerInfo.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customerInfo.address}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customerInfo.city}, {customerInfo.state} {customerInfo.zipCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customerInfo.country}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Email: {customerInfo.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Phone: {customerInfo.phone}
                        </p>
                      </div>

                      {/* Items */}
                      <div className="mb-8 pb-8 border-b border-border">
                        <h3 className="font-medium text-foreground mb-4">Order Items</h3>
                        <div className="space-y-3">
                          {items.map(item => (
                            <div key={`${item.id}-${item.variant}`} className="flex justify-between text-sm">
                              <span className="text-foreground">
                                {item.name} ({item.variant}) x {item.quantity}
                              </span>
                              <span className="font-medium">
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-4 mt-8">
                        <Button variant="outline" onClick={() => setStep('info')} className="h-12">
                          Back to Info
                        </Button>
                        <Button 
                          onClick={handlePlaceOrder} 
                          disabled={isProcessing}
                          className="flex-1 h-12"
                        >
                          {isProcessing ? 'Processing...' : 'Place Order'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Order Total Sidebar */}
              <div className="lg:col-span-1">
                <Card className="border-border/50 sticky top-24">
                  <CardContent className="p-8">
                    <h3 className="font-serif text-xl font-medium mb-6">Order Total</h3>

                    <div className="space-y-3 mb-6 pb-6 border-b border-border">
                      {items.map(item => (
                        <div key={`${item.id}-${item.variant}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.name} x {item.quantity}
                          </span>
                          <span className="text-foreground font-medium">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Shipping</span>
                        <span>Calculated at next step</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax</span>
                        <span>Calculated at next step</span>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border flex justify-between items-center">
                      <span className="font-serif text-lg font-medium">Total</span>
                      <span className="font-serif text-2xl font-medium">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
