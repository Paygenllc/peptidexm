'use client'

import { useState } from 'react'
import { useCart } from '@/context/cart-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle, Plus, Minus, Trash2, Mail, Phone, User, MapPin, Building2, Globe, Hash, ChevronDown, Home } from 'lucide-react'
import Link from 'next/link'
import { US_STATES, COUNTRIES } from '@/lib/locations'
import { placeOrderAction } from '@/app/actions/place-order'

interface CustomerInfo {
  email: string
  phone: string
  firstName: string
  lastName: string
  address: string
  address2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export default function CheckoutPage() {
  const { items, total, clearCart, updateQuantity, removeItem } = useCart()
  const [step, setStep] = useState<'cart' | 'info' | 'summary' | 'success'>('cart')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    address: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)

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
    setPlaceError(null)
    try {
      const result = await placeOrderAction({
        email: customerInfo.email,
        phone: customerInfo.phone,
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        address: customerInfo.address,
        address2: customerInfo.address2,
        city: customerInfo.city,
        state: customerInfo.state,
        zipCode: customerInfo.zipCode,
        country: customerInfo.country,
        items: items.map(item => ({
          productName: item.name,
          variantName: item.variant,
          unitPrice: item.price,
          quantity: item.quantity,
          imageUrl: item.image,
        })),
      })

      if (result.error) {
        setPlaceError(result.error)
        return
      }

      setPlacedOrderNumber(result.orderNumber ?? null)
      setStep('success')
      clearCart()
    } catch (e) {
      console.error('[v0] place order failed', e)
      setPlaceError('Something went wrong placing your order. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="min-h-screen bg-secondary/30 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16 sm:py-24">
            <h1 className="font-serif text-3xl sm:text-4xl font-medium mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">Add some peptides to get started</p>
            <Button asChild size="lg" className="h-12">
              <Link href="/">Back to Store</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-6 sm:py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Success Page */}
        {step === 'success' && (
          <div className="text-center py-16 sm:py-24">
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-14 w-14 sm:h-16 sm:w-16 text-green-600" />
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium mb-4 text-balance">Order Placed Successfully!</h1>
            {placedOrderNumber && (
              <p className="text-muted-foreground mb-2 text-sm sm:text-base">
                Order <span className="font-mono font-medium text-foreground break-all">{placedOrderNumber}</span>
              </p>
            )}
            <p className="text-muted-foreground mb-8 text-sm sm:text-base px-4">
              A confirmation will be sent to <span className="font-medium break-all">{customerInfo.email}</span>
            </p>
            <Button asChild size="lg" className="h-12">
              <Link href="/">Return to Store</Link>
            </Button>
          </div>
        )}

        {/* Checkout Steps */}
        {step !== 'success' && (
          <>
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Store
              </Link>

              <h1 className="font-serif text-3xl sm:text-4xl font-medium mb-4">Checkout</h1>

              {/* Step Indicator - compact on mobile */}
              <div className="flex gap-2 sm:gap-3 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto no-scrollbar">
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg shrink-0 ${step === 'cart' || step === 'info' || step === 'summary' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap"><span className="sm:hidden">1. Cart</span><span className="hidden sm:inline">1. Cart Review</span></span>
                </div>
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg shrink-0 ${step === 'info' || step === 'summary' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap"><span className="sm:hidden">2. Info</span><span className="hidden sm:inline">2. Shipping Info</span></span>
                </div>
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg shrink-0 ${step === 'summary' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'}`}>
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap"><span className="sm:hidden">3. Review</span><span className="hidden sm:inline">3. Order Summary</span></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                {/* Step 1: Cart Review */}
                {step === 'cart' && (
                  <Card className="border-2 border-border">
                    <CardContent className="p-4 sm:p-6 lg:p-8">
                      <h2 className="font-serif text-xl sm:text-2xl font-medium mb-4 sm:mb-6">Cart Review</h2>
                      <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                        {items.map(item => (
                          <div
                            key={`${item.id}-${item.variant}`}
                            className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-secondary rounded-xl border-2 border-border"
                          >
                            {/* Product Image */}
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-background rounded-lg flex-shrink-0 overflow-hidden border-2 border-border">
                              <img
                                src={item.image || '/placeholder.svg'}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Details */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <h3 className="font-serif font-semibold text-foreground text-base line-clamp-1">
                                  {item.name}
                                </h3>
                                <p className="text-sm text-accent font-medium mt-1">{item.variant}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  ${item.price.toFixed(2)} each
                                </p>
                              </div>

                              {/* Controls Row */}
                              <div className="flex items-center justify-between gap-3 mt-3">
                                {/* Quantity Controls */}
                                <div className="flex items-center bg-background border-2 border-border rounded-lg p-1">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, item.variant, Math.max(1, item.quantity - 1))}
                                    className="p-1.5 hover:bg-accent hover:text-accent-foreground rounded transition-colors"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <span className="text-sm font-bold w-8 text-center text-foreground">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                                    className="p-1.5 hover:bg-accent hover:text-accent-foreground rounded transition-colors"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>

                                {/* Subtotal */}
                                <span className="font-serif font-bold text-lg text-accent">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>

                                {/* Remove */}
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id, item.variant)}
                                  className="p-2 hover:bg-red-100 dark:hover:bg-red-950 text-red-600 hover:text-red-700 rounded-lg transition-colors"
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" asChild className="h-12 sm:flex-1">
                          <Link href="/#products">Add More Items</Link>
                        </Button>
                        <Button onClick={handleContinueToInfo} className="h-12 sm:flex-1">
                          Continue to Shipping Info
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Customer Info */}
                {step === 'info' && (
                  <Card className="border-2 border-border">
                    <CardContent className="p-4 sm:p-6 lg:p-8">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-accent" />
                        </div>
                        <h2 className="font-serif text-2xl font-medium">Shipping Information</h2>
                      </div>
                      <p className="text-sm text-muted-foreground mb-8 ml-13">
                        Enter your contact and shipping details below
                      </p>

                      <form className="space-y-8">
                        {/* Contact Information Section */}
                        <div>
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                            <User className="h-4 w-4 text-accent" />
                            <h3 className="font-medium text-sm text-foreground uppercase tracking-wide">
                              Contact Information
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                Email Address *
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                  type="email"
                                  value={customerInfo.email}
                                  onChange={(e) => handleInputChange('email', e.target.value)}
                                  className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                    errors.email ? 'border-red-500' : 'border-border'
                                  }`}
                                  placeholder="john@example.com"
                                />
                              </div>
                              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
                            </div>

                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                Phone Number *
                              </label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                  type="tel"
                                  value={customerInfo.phone}
                                  onChange={(e) => handleInputChange('phone', e.target.value)}
                                  className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                    errors.phone ? 'border-red-500' : 'border-border'
                                  }`}
                                  placeholder="(555) 123-4567"
                                />
                              </div>
                              {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
                            </div>

                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                First Name *
                              </label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                  type="text"
                                  value={customerInfo.firstName}
                                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                                  className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                    errors.firstName ? 'border-red-500' : 'border-border'
                                  }`}
                                  placeholder="John"
                                />
                              </div>
                              {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>}
                            </div>

                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                Last Name *
                              </label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                  type="text"
                                  value={customerInfo.lastName}
                                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                                  className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                    errors.lastName ? 'border-red-500' : 'border-border'
                                  }`}
                                  placeholder="Doe"
                                />
                              </div>
                              {errors.lastName && <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>}
                            </div>
                          </div>
                        </div>

                        {/* Shipping Address Section */}
                        <div>
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                            <Home className="h-4 w-4 text-accent" />
                            <h3 className="font-medium text-sm text-foreground uppercase tracking-wide">
                              Shipping Address
                            </h3>
                          </div>

                          <div className="space-y-4">
                            {/* Country */}
                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                Country *
                              </label>
                              <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <select
                                  value={customerInfo.country}
                                  onChange={(e) => handleInputChange('country', e.target.value)}
                                  className="w-full pl-10 pr-10 py-2.5 border-2 border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors appearance-none cursor-pointer"
                                >
                                  {COUNTRIES.map(country => (
                                    <option key={country.code} value={country.name}>
                                      {country.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                              </div>
                            </div>

                            {/* Street Address */}
                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                Street Address *
                              </label>
                              <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                  type="text"
                                  value={customerInfo.address}
                                  onChange={(e) => handleInputChange('address', e.target.value)}
                                  className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                    errors.address ? 'border-red-500' : 'border-border'
                                  }`}
                                  placeholder="123 Main Street"
                                />
                              </div>
                              {errors.address && <p className="text-red-600 text-sm mt-1">{errors.address}</p>}
                            </div>

                            {/* Address Line 2 */}
                            <div>
                              <label className="text-sm font-medium text-foreground block mb-2">
                                Apartment, Suite, etc. <span className="text-muted-foreground font-normal">(optional)</span>
                              </label>
                              <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                  type="text"
                                  value={customerInfo.address2}
                                  onChange={(e) => handleInputChange('address2', e.target.value)}
                                  className="w-full pl-10 pr-4 py-2.5 border-2 border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
                                  placeholder="Apt 4B"
                                />
                              </div>
                            </div>

                            {/* City, State, ZIP */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-sm font-medium text-foreground block mb-2">
                                  City *
                                </label>
                                <div className="relative">
                                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                  <input
                                    type="text"
                                    value={customerInfo.city}
                                    onChange={(e) => handleInputChange('city', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.city ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="New York"
                                  />
                                </div>
                                {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city}</p>}
                              </div>

                              <div>
                                <label className="text-sm font-medium text-foreground block mb-2">
                                  State *
                                </label>
                                {customerInfo.country === 'United States' ? (
                                  <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <select
                                      value={customerInfo.state}
                                      onChange={(e) => handleInputChange('state', e.target.value)}
                                      className={`w-full pl-10 pr-10 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors appearance-none cursor-pointer ${
                                        errors.state ? 'border-red-500' : 'border-border'
                                      }`}
                                    >
                                      <option value="">Select state</option>
                                      {US_STATES.map(state => (
                                        <option key={state.code} value={state.code}>
                                          {state.name}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <input
                                      type="text"
                                      value={customerInfo.state}
                                      onChange={(e) => handleInputChange('state', e.target.value)}
                                      className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                        errors.state ? 'border-red-500' : 'border-border'
                                      }`}
                                      placeholder="Province/Region"
                                    />
                                  </div>
                                )}
                                {errors.state && <p className="text-red-600 text-sm mt-1">{errors.state}</p>}
                              </div>

                              <div>
                                <label className="text-sm font-medium text-foreground block mb-2">
                                  ZIP Code *
                                </label>
                                <div className="relative">
                                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                  <input
                                    type="text"
                                    value={customerInfo.zipCode}
                                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.zipCode ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="10001"
                                  />
                                </div>
                                {errors.zipCode && <p className="text-red-600 text-sm mt-1">{errors.zipCode}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </form>

                      <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t-2 border-border">
                        <Button variant="outline" onClick={() => setStep('cart')} className="h-12 sm:flex-1">
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Cart
                        </Button>
                        <Button onClick={handleContinueToSummary} className="h-12 sm:flex-[2]">
                          Continue to Summary
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Step 3: Order Summary */}
                {step === 'summary' && (
                  <Card className="border-border/50">
                    <CardContent className="p-4 sm:p-6 lg:p-8">
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
                        {customerInfo.address2 && (
                          <p className="text-sm text-muted-foreground">
                            {customerInfo.address2}
                          </p>
                        )}
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

                      {placeError && (
                        <div className="mt-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm" role="alert">
                          {placeError}
                        </div>
                      )}
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
                  <CardContent className="p-4 sm:p-6 lg:p-8">
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
