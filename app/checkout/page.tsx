'use client'

import { useEffect, useState } from 'react'
import { useCart } from '@/context/cart-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Minus,
  Trash2,
  Mail,
  Phone,
  User,
  MapPin,
  Building2,
  Globe,
  Hash,
  ChevronDown,
  Home,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { US_STATES, COUNTRIES } from '@/lib/locations'
import { placeOrderAction } from '@/app/actions/place-order'
import {
  getShippingFee,
  isUSCountry,
  amountToFreeShipping,
  US_FREE_SHIPPING_THRESHOLD,
} from '@/lib/shipping'
import { ZellePaymentPanel } from '@/components/zelle-payment-panel'
import { CryptoPaymentPanel } from '@/components/crypto-payment-panel'
import { ZelleLogo, TetherLogo, CardBrandRow } from '@/components/payment-logos'
import { AbandonedCartTracker } from '@/components/abandoned-cart-tracker'

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

type Step = 'cart' | 'checkout' | 'success'

export default function CheckoutPage() {
  const { items, total, clearCart, updateQuantity, removeItem } = useCart()
  const [step, setStep] = useState<Step>('cart')
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

  // When a shopper arrives here via the abandoned-cart recovery link,
  // the companion client component drops their email into sessionStorage
  // so we can prefill the form and save them a step. Consume-and-forget
  // so it doesn't stick around for unrelated future sessions.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const recoveredEmail = window.sessionStorage.getItem('peptidexm-recovered-email')
      if (recoveredEmail) {
        setCustomerInfo((prev) => (prev.email ? prev : { ...prev, email: recoveredEmail }))
        window.sessionStorage.removeItem('peptidexm-recovered-email')
      }
    } catch {
      // sessionStorage disabled (private tabs etc) — silent no-op.
    }
  }, [])
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null)
  const [placedOrderTotal, setPlacedOrderTotal] = useState<number | null>(null)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)
  // Which payment method the shopper chose on the checkout step. Drives both
  // the order row's payment_method column and which panel we show on success.
  const [paymentMethod, setPaymentMethod] = useState<'zelle' | 'crypto'>('zelle')

  // Subtotal decides free-shipping eligibility for US orders; pass it along
  // so the displayed fee matches what `placeOrderAction` will charge server-side.
  const shippingFee = getShippingFee(customerInfo.country, total)
  const isUS = isUSCountry(customerInfo.country)
  const freeShipRemaining = amountToFreeShipping(customerInfo.country, total)
  const qualifiesForFreeShip = isUS && shippingFee === 0
  const orderTotal = total + shippingFee

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

  const handleContinueToCheckout = () => {
    setStep('checkout')
  }

  const handlePlaceOrder = async () => {
    // Validate first, scroll the first error into view if any
    if (!validateInfo()) {
      if (typeof window !== 'undefined') {
        const firstErrorEl = document.querySelector('[data-error="true"]') as HTMLElement | null
        firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

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
        items: items.map((item) => ({
          productName: item.name,
          variantName: item.variant,
          unitPrice: item.price,
          quantity: item.quantity,
          imageUrl: item.image,
        })),
        paymentMethod,
      })

      if (result.error) {
        setPlaceError(result.error)
        return
      }

      setPlacedOrderNumber(result.orderNumber ?? null)
      setPlacedOrderTotal(typeof result.total === 'number' ? result.total : orderTotal)
      setPlacedOrderId(result.orderId ?? null)
      setStep('success')
      clearCart()
      // Scroll to the top so the Zelle panel lands in view cleanly
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (e) {
      console.error('[v0] place order failed', e)
      setPlaceError('Something went wrong placing your order. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
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
  {/* Persist the in-progress cart so we can nudge the shopper by email
   * if they don't complete checkout. Only active before the order is
   * placed — afterwards the row is marked recovered server-side. */}
  {step !== 'success' && (
    <AbandonedCartTracker
      email={customerInfo.email}
      firstName={customerInfo.firstName}
      lastName={customerInfo.lastName}
      phone={customerInfo.phone}
      items={items}
    />
  )}
  <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
  {/* Success Page */}
        {step === 'success' && (
          <div className="py-8 sm:py-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 sm:h-9 sm:w-9 text-green-700" />
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-medium mb-2 text-balance">Order placed</h1>
              {placedOrderNumber && (
                <p className="text-muted-foreground text-sm sm:text-base">
                  Order{' '}
                  <span className="font-mono font-medium text-foreground break-all">
                    {placedOrderNumber}
                  </span>
                </p>
              )}
              <p className="text-muted-foreground text-sm sm:text-base mt-1 px-4">
                Confirmation sent to{' '}
                <span className="font-medium break-all">{customerInfo.email}</span>
              </p>
            </div>

            {placedOrderNumber && placedOrderTotal !== null && (
              <div className="mx-auto max-w-xl">
                {paymentMethod === 'crypto' && placedOrderId ? (
                  <CryptoPaymentPanel
                    orderId={placedOrderId}
                    orderNumber={placedOrderNumber}
                    total={placedOrderTotal}
                    customerEmail={customerInfo.email}
                  />
                ) : (
                  <ZellePaymentPanel
                    orderNumber={placedOrderNumber}
                    total={placedOrderTotal}
                    customerEmail={customerInfo.email}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Checkout Steps */}
        {step !== 'success' && (
          <>
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Store
              </Link>

              <h1 className="font-serif text-3xl sm:text-4xl font-medium mb-4">Checkout</h1>

              {/* Step Indicator — two steps now */}
              <div className="flex gap-2 sm:gap-3">
                <div
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg ${
                    step === 'cart' || step === 'checkout'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                    1. Cart Review
                  </span>
                </div>
                <div
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg ${
                    step === 'checkout'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                    2. Shipping &amp; Payment
                  </span>
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
                      <h2 className="font-serif text-xl sm:text-2xl font-medium mb-4 sm:mb-6">
                        Cart Review
                      </h2>
                      <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                        {items.map((item) => (
                          <div
                            key={`${item.id}-${item.variant}`}
                            className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-secondary rounded-xl border-2 border-border"
                          >
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-background rounded-lg flex-shrink-0 overflow-hidden border-2 border-border">
                              <img
                                src={item.image || '/placeholder.svg'}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <h3 className="font-serif font-semibold text-foreground text-base line-clamp-1">
                                  {item.name}
                                </h3>
                                <p className="text-sm text-accent font-medium mt-1">
                                  {item.variant}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  ${item.price.toFixed(2)} each
                                </p>
                              </div>

                              <div className="flex items-center justify-between gap-3 mt-3">
                                <div className="flex items-center bg-background border-2 border-border rounded-lg p-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(
                                        item.id,
                                        item.variant,
                                        Math.max(1, item.quantity - 1),
                                      )
                                    }
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
                                    onClick={() =>
                                      updateQuantity(item.id, item.variant, item.quantity + 1)
                                    }
                                    className="p-1.5 hover:bg-accent hover:text-accent-foreground rounded transition-colors"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>

                                <span className="font-serif font-bold text-lg text-accent">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>

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
                        <Button onClick={handleContinueToCheckout} className="h-12 sm:flex-1">
                          Continue to Shipping &amp; Payment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Shipping + Summary + Payment (all on one page) */}
                {step === 'checkout' && (
                  <div className="space-y-6">
                    {/* Shipping Information */}
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

                        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                          {/* Contact Information */}
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
                                    data-error={!!errors.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.email ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="john@example.com"
                                  />
                                </div>
                                {errors.email && (
                                  <p className="text-red-600 text-sm mt-1">{errors.email}</p>
                                )}
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
                                    data-error={!!errors.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.phone ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="(555) 123-4567"
                                  />
                                </div>
                                {errors.phone && (
                                  <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
                                )}
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
                                    data-error={!!errors.firstName}
                                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.firstName ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="John"
                                  />
                                </div>
                                {errors.firstName && (
                                  <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>
                                )}
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
                                    data-error={!!errors.lastName}
                                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.lastName ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="Doe"
                                  />
                                </div>
                                {errors.lastName && (
                                  <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Shipping Address */}
                          <div>
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                              <Home className="h-4 w-4 text-accent" />
                              <h3 className="font-medium text-sm text-foreground uppercase tracking-wide">
                                Shipping Address
                              </h3>
                            </div>

                            <div className="space-y-4">
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
                                    {COUNTRIES.map((country) => (
                                      <option key={country.code} value={country.name}>
                                        {country.name}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium text-foreground block mb-2">
                                  Street Address *
                                </label>
                                <div className="relative">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                  <input
                                    type="text"
                                    value={customerInfo.address}
                                    data-error={!!errors.address}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                      errors.address ? 'border-red-500' : 'border-border'
                                    }`}
                                    placeholder="123 Main Street"
                                  />
                                </div>
                                {errors.address && (
                                  <p className="text-red-600 text-sm mt-1">{errors.address}</p>
                                )}
                              </div>

                              <div>
                                <label className="text-sm font-medium text-foreground block mb-2">
                                  Apartment, Suite, etc.{' '}
                                  <span className="text-muted-foreground font-normal">
                                    (optional)
                                  </span>
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
                                      data-error={!!errors.city}
                                      onChange={(e) => handleInputChange('city', e.target.value)}
                                      className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                        errors.city ? 'border-red-500' : 'border-border'
                                      }`}
                                      placeholder="New York"
                                    />
                                  </div>
                                  {errors.city && (
                                    <p className="text-red-600 text-sm mt-1">{errors.city}</p>
                                  )}
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
                                        data-error={!!errors.state}
                                        onChange={(e) => handleInputChange('state', e.target.value)}
                                        className={`w-full pl-10 pr-10 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors appearance-none cursor-pointer ${
                                          errors.state ? 'border-red-500' : 'border-border'
                                        }`}
                                      >
                                        <option value="">Select state</option>
                                        {US_STATES.map((state) => (
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
                                        data-error={!!errors.state}
                                        onChange={(e) => handleInputChange('state', e.target.value)}
                                        className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                          errors.state ? 'border-red-500' : 'border-border'
                                        }`}
                                        placeholder="Province/Region"
                                      />
                                    </div>
                                  )}
                                  {errors.state && (
                                    <p className="text-red-600 text-sm mt-1">{errors.state}</p>
                                  )}
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
                                      data-error={!!errors.zipCode}
                                      onChange={(e) => handleInputChange('zipCode', e.target.value)}
                                      className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                                        errors.zipCode ? 'border-red-500' : 'border-border'
                                      }`}
                                      placeholder="10001"
                                    />
                                  </div>
                                  {errors.zipCode && (
                                    <p className="text-red-600 text-sm mt-1">{errors.zipCode}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Payment Method Summary */}
                    <Card className="border-2 border-border">
                      <CardContent className="p-4 sm:p-6 lg:p-8">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Lock className="h-5 w-5 text-accent" />
                          </div>
                          <h2 className="font-serif text-2xl font-medium">Payment Method</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6 ml-13">
                          Choose how you&apos;d like to pay. You&apos;ll complete payment
                          on the next screen.
                        </p>

                        <fieldset
                          className="space-y-3"
                          aria-label="Payment method"
                        >
                          <legend className="sr-only">Payment method</legend>

                          <label
                            className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                              paymentMethod === 'zelle'
                                ? 'border-accent bg-accent/5'
                                : 'border-border hover:border-accent/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="zelle"
                              checked={paymentMethod === 'zelle'}
                              onChange={() => setPaymentMethod('zelle')}
                              className="sr-only"
                            />
                            <div
                              className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                paymentMethod === 'zelle'
                                  ? 'border-accent bg-accent'
                                  : 'border-border'
                              }`}
                              aria-hidden="true"
                            >
                              {paymentMethod === 'zelle' && (
                                <div className="h-2 w-2 rounded-full bg-accent-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5">
                                <ZelleLogo
                                  className="h-7 w-7 shrink-0"
                                  aria-hidden="true"
                                />
                                <p className="font-medium text-foreground">Zelle</p>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                Send from your bank&apos;s Zelle using your order
                                number in the memo. We&apos;ll email the payment
                                details right after checkout.
                              </p>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                              paymentMethod === 'crypto'
                                ? 'border-accent bg-accent/5'
                                : 'border-border hover:border-accent/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="crypto"
                              checked={paymentMethod === 'crypto'}
                              onChange={() => setPaymentMethod('crypto')}
                              className="sr-only"
                            />
                            <div
                              className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                paymentMethod === 'crypto'
                                  ? 'border-accent bg-accent'
                                  : 'border-border'
                              }`}
                              aria-hidden="true"
                            >
                              {paymentMethod === 'crypto' && (
                                <div className="h-2 w-2 rounded-full bg-accent-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <TetherLogo
                                  className="h-7 w-7 shrink-0"
                                  aria-hidden="true"
                                />
                                <p className="font-medium text-foreground">USDT</p>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent uppercase tracking-wider">
                                  TRC-20
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                Pay in Tether on the TRON network via our secure
                                payment partner. Your order is marked paid
                                automatically once the network confirms.
                              </p>
                            </div>
                          </label>

                          {/* Card payment — intentionally visible but disabled.
                           * Shows which brands we'll accept once processing
                           * comes back online. The radio input is
                           * `disabled` (keyboard users get the native
                           * disabled state) and the wrapping label is
                           * `aria-disabled` + `cursor-not-allowed` so click
                           * attempts don't select it. Do NOT remove the
                           * `pointer-events-none` on the inner input — it
                           * belt-and-suspenders the `disabled` attribute
                           * against any future CSS reset. */}
                          <label
                            aria-disabled="true"
                            className="flex items-start gap-3 rounded-lg border-2 border-border bg-muted/30 p-4 cursor-not-allowed opacity-70 relative"
                            title="Card payments are temporarily unavailable"
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="card"
                              disabled
                              aria-disabled="true"
                              tabIndex={-1}
                              className="sr-only pointer-events-none"
                            />
                            <div
                              className="mt-0.5 h-5 w-5 rounded-full border-2 border-border/70 flex items-center justify-center flex-shrink-0 bg-muted"
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <p className="font-medium text-muted-foreground">
                                  Credit / Debit card
                                </p>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30 uppercase tracking-wider">
                                  Under maintenance
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                <CardBrandRow />
                              </div>
                              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                We accept Visa, Mastercard, American Express, and
                                Discover. Card processing is temporarily offline
                                for an upgrade &mdash; please use Zelle or USDT
                                in the meantime.
                              </p>
                            </div>
                          </label>
                        </fieldset>
                      </CardContent>
                    </Card>

                    {/* Mobile-only: compact inline order summary + place order CTA.
                        On desktop the sticky sidebar handles this. */}
                    <div className="lg:hidden">
                      <Card className="border-2 border-border">
                        <CardContent className="p-4 sm:p-6">
                          <h3 className="font-serif text-lg font-medium mb-4">Order Summary</h3>
                          <div className="space-y-2 text-sm mb-4 pb-4 border-b border-border">
                            {items.map((item) => (
                              <div
                                key={`${item.id}-${item.variant}-mobile`}
                                className="flex justify-between gap-3"
                              >
                                <span className="text-muted-foreground min-w-0 truncate">
                                  {item.name} × {item.quantity}
                                </span>
                                <span className="text-foreground font-medium tabular-nums shrink-0">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span>
                              <span className="tabular-nums">${total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Shipping {isUS ? '(US)' : '(Intl.)'}</span>
                              {qualifiesForFreeShip ? (
                                <span className="font-semibold text-accent uppercase tracking-wide">
                                  Free
                                </span>
                              ) : (
                                <span className="tabular-nums">${shippingFee.toFixed(2)}</span>
                              )}
                            </div>
                            {isUS && freeShipRemaining !== null && freeShipRemaining > 0 && (
                              <p className="text-xs text-muted-foreground/90 bg-accent/5 border border-accent/20 rounded-md px-2 py-1.5 mt-1">
                                Add{' '}
                                <span className="font-semibold text-foreground tabular-nums">
                                  ${freeShipRemaining.toFixed(2)}
                                </span>{' '}
                                more for free US shipping.
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-border flex items-center justify-between mb-4">
                            <span className="font-serif text-base font-medium">Total</span>
                            <span className="font-serif text-xl font-medium tabular-nums">
                              ${orderTotal.toFixed(2)}
                            </span>
                          </div>

                          {placeError && (
                            <div
                              className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
                              role="alert"
                            >
                              {placeError}
                            </div>
                          )}

                          <Button
                            onClick={handlePlaceOrder}
                            disabled={isProcessing}
                            className="w-full h-12"
                          >
                            {isProcessing ? 'Processing...' : `Place Order · $${orderTotal.toFixed(2)}`}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setStep('cart')}
                            className="w-full h-12 mt-3"
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Cart
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Total Sidebar (desktop sticky) */}
              <div className="hidden lg:block lg:col-span-1">
                <Card className="border-border/50 sticky top-24">
                  <CardContent className="p-6 lg:p-8">
                    <h3 className="font-serif text-xl font-medium mb-6">Order Summary</h3>

                    <div className="space-y-3 mb-6 pb-6 border-b border-border">
                      {items.map((item) => (
                        <div
                          key={`${item.id}-${item.variant}-desktop`}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span className="text-muted-foreground min-w-0 truncate">
                            {item.name} × {item.quantity}
                          </span>
                          <span className="text-foreground font-medium tabular-nums shrink-0">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tabular-nums">${total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Shipping {isUS ? '(US)' : '(International)'}</span>
                        {qualifiesForFreeShip ? (
                          <span className="font-semibold text-accent uppercase tracking-wide">
                            Free
                          </span>
                        ) : (
                          <span className="tabular-nums">${shippingFee.toFixed(2)}</span>
                        )}
                      </div>
                      {isUS && freeShipRemaining !== null && freeShipRemaining > 0 && (
                        <div className="rounded-md border border-accent/20 bg-accent/5 px-3 py-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            You&apos;re{' '}
                            <span className="font-semibold text-foreground tabular-nums">
                              ${freeShipRemaining.toFixed(2)}
                            </span>{' '}
                            away from free US shipping.
                          </p>
                          <div className="mt-1.5 h-1 w-full rounded-full bg-accent/10 overflow-hidden">
                            <div
                              className="h-full bg-accent transition-[width] duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (total / US_FREE_SHIPPING_THRESHOLD) * 100,
                                ).toFixed(1)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {qualifiesForFreeShip && (
                        <p className="text-xs text-accent font-medium mt-1">
                          Your order qualifies for free US shipping.
                        </p>
                      )}
                      <div className="flex justify-between text-xs text-muted-foreground/80">
                        <span>Tax</span>
                        <span className="tabular-nums">$0.00</span>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border flex justify-between items-center mb-6">
                      <span className="font-serif text-lg font-medium">Total</span>
                      <span className="font-serif text-2xl font-medium tabular-nums">
                        ${orderTotal.toFixed(2)}
                      </span>
                    </div>

                    {step === 'checkout' && (
                      <>
                        {placeError && (
                          <div
                            className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
                            role="alert"
                          >
                            {placeError}
                          </div>
                        )}
                        <Button
                          onClick={handlePlaceOrder}
                          disabled={isProcessing}
                          className="w-full h-12"
                        >
                          {isProcessing ? 'Processing...' : 'Place Order'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setStep('cart')}
                          className="w-full h-11 mt-3"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Cart
                        </Button>
                        <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
                          By placing your order you agree to our terms. Payment details appear
                          right after.
                        </p>
                      </>
                    )}
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
