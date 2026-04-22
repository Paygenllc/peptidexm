import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Truck,
  ExternalLink,
  MapPin,
  CreditCard,
  Package,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { resolveCarrierInfo } from "@/lib/carrier"
import { ZellePaymentPanel } from "@/components/zelle-payment-panel"

// Customer-facing order detail page. Reuses the RLS policy
// `orders_user_by_email` which only allows authenticated users to
// SELECT orders where `email = auth.email() OR user_id = auth.uid()`,
// so the DB itself enforces that one customer can't load another
// customer's order by URL-guessing the `order_number`.
//
// This page is the permanent "receipt" — the post-checkout success
// panel on `/checkout` is a transient view; once a customer signs in
// this URL is where they come back to see what they ordered and
// where the package is.

export const dynamic = "force-dynamic"

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processing: "secondary",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
  refunded: "outline",
  pending: "secondary",
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  })
}

function formatPaymentMethod(method: string): string {
  // DB stores raw strings like "card" / "zelle" / "paypal" / "crypto".
  // Render them in the human-friendly form shoppers expect.
  const m = method.toLowerCase().trim()
  if (m === "card") return "Credit or Debit Card"
  if (m === "paypal") return "PayPal"
  if (m === "zelle") return "Zelle"
  if (m === "crypto") return "Crypto (USDT)"
  return method
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}): Promise<Metadata> {
  const { orderNumber } = await params
  return {
    title: `Order ${orderNumber}`,
    description: `Details for order ${orderNumber}.`,
    robots: {
      // Never allow crawlers to index customer-specific order pages.
      index: false,
      follow: false,
    },
  }
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/signin?error=auth_required&next=${encodeURIComponent(`/account/orders/${orderNumber}`)}`)
  }

  // Primary lookup. RLS scopes this to just the caller's orders,
  // so a 200 here means the row belongs to them.
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .maybeSingle()

  if (!order) notFound()

  // Items are a separate table; RLS there piggybacks off the order's
  // RLS, so this will only succeed if the parent order is visible.
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true })

  const status = String(order.status || "processing").toLowerCase()
  const paymentStatus = String(order.payment_status || "pending").toLowerCase()
  const tracking = resolveCarrierInfo(order.tracking_number, order.tracking_carrier, order.tracking_url)

  const itemCount = (items ?? []).reduce((sum, i) => sum + (i.quantity || 0), 0)
  const subtotal = Number(order.subtotal)
  const shipping = Number(order.shipping)
  const tax = Number(order.tax)
  const total = Number(order.total)

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to my account
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-foreground break-all">
              {order.order_number}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1.5">
              Placed {formatDateTime(order.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className="capitalize text-xs">
              {status}
            </Badge>
            <Badge
              variant={paymentStatus === "paid" ? "default" : "outline"}
              className="capitalize text-xs"
            >
              Payment: {paymentStatus}
            </Badge>
          </div>
        </div>

        {/* Tracking hero — rendered as a prominent strip above the
            two-column grid so it's the first thing a shopper sees
            when they return to this page after shipment. */}
        {tracking && (
          <Card className="mb-6 border-accent/40 bg-accent/5">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Truck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      {tracking.label} tracking
                    </p>
                    <p className="font-mono text-sm sm:text-base text-foreground break-all mt-0.5">
                      {order.tracking_number}
                    </p>
                  </div>
                </div>
                {tracking.trackingUrl && (
                  <Button asChild size="lg" className="gap-2 shrink-0">
                    <a
                      href={tracking.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Track this package on ${tracking.label}'s website (opens in a new tab)`}
                    >
                      Track on {tracking.label}
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status-without-tracking empty state — keeps the shopper
            from wondering "where's my package?" */}
        {!tracking && status !== "delivered" && status !== "cancelled" && (
          <Card className="mb-6 border-dashed">
            <CardContent className="p-5 sm:p-6 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                {paymentStatus === "paid" ? (
                  <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {paymentStatus === "paid" ? "Preparing your order" : "Awaiting payment"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                  {paymentStatus === "paid"
                    ? "We'll email you the tracking number the moment your package ships."
                    : "Your order will be prepared as soon as payment is confirmed."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two-column layout: items + summary on left, address +
            payment on right. Collapses to a single column on mobile. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN — items + totals */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-lg sm:text-xl font-medium">
                    Items ordered
                  </h2>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>

                <ul className="divide-y divide-border">
                  {(items ?? []).map((item) => (
                    <li key={item.id} className="flex items-start gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0">
                      {/* Thumbnail falls back to a package icon
                          tile when image_url isn't set — some older
                          orders predate the column backfill. */}
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border border-border shrink-0 bg-secondary"
                        />
                      ) : (
                        <div
                          className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg border border-border bg-secondary shrink-0 flex items-center justify-center"
                          aria-hidden="true"
                        >
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm sm:text-base">
                            {item.product_name}
                          </p>
                          {item.variant_name && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              {item.variant_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                            ${Number(item.unit_price).toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="font-serif text-base sm:text-lg text-foreground tabular-nums shrink-0">
                          ${Number(item.line_total).toFixed(2)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <Separator className="my-4 sm:my-5" />

                {/* Totals */}
                <dl className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">${subtotal.toFixed(2)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="tabular-nums">
                      {shipping === 0 ? (
                        <span className="uppercase text-xs font-semibold text-emerald-700">Free</span>
                      ) : (
                        `$${shipping.toFixed(2)}`
                      )}
                    </dd>
                  </div>
                  {tax > 0 && (
                    <div className="flex items-baseline justify-between">
                      <dt className="text-muted-foreground">Tax</dt>
                      <dd className="tabular-nums">${tax.toFixed(2)}</dd>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-baseline justify-between font-medium">
                    <dt className="text-foreground">Total</dt>
                    <dd className="font-serif text-xl tabular-nums text-foreground">
                      ${total.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Zelle pending-payment panel — same component used on
                the /account list and the /checkout return view, so
                shoppers get one consistent way to submit their
                transaction reference. */}
            {paymentStatus === "pending" &&
              !order.payment_reference &&
              status !== "cancelled" &&
              String(order.payment_method).toLowerCase() === "zelle" && (
                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <ZellePaymentPanel
                      orderNumber={order.order_number}
                      total={total}
                      customerEmail={order.email ?? user.email ?? ""}
                    />
                  </CardContent>
                </Card>
              )}

            {/* Payment-reference-submitted banner */}
            {order.payment_reference && paymentStatus !== "paid" && (
              <Card className="bg-secondary/60">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Payment reference received</p>
                      <p className="font-mono text-xs text-muted-foreground break-all mt-1">
                        {order.payment_reference}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        We&apos;ll verify the transfer and ship shortly. You&apos;ll get an email as
                        soon as your order is on the way.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN — shipping + payment metadata */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="font-serif text-base sm:text-lg font-medium">Ship to</h2>
                </div>
                <address className="not-italic text-sm leading-relaxed text-foreground">
                  <div className="font-medium">
                    {order.first_name} {order.last_name}
                  </div>
                  <div className="text-muted-foreground mt-1">{order.address_line1}</div>
                  {order.address_line2 && (
                    <div className="text-muted-foreground">{order.address_line2}</div>
                  )}
                  <div className="text-muted-foreground">
                    {order.city}, {order.state} {order.zip_code}
                  </div>
                  <div className="text-muted-foreground">{order.country}</div>
                </address>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="font-serif text-base sm:text-lg font-medium">Payment</h2>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Method
                    </dt>
                    <dd className="text-foreground mt-0.5">{formatPaymentMethod(order.payment_method)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Status
                    </dt>
                    <dd className="capitalize text-foreground mt-0.5">{paymentStatus}</dd>
                  </div>
                  {/* Only show the payment reference if it exists —
                      mostly a Zelle / crypto breadcrumb. */}
                  {order.payment_reference && (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Reference
                      </dt>
                      <dd className="font-mono text-xs text-muted-foreground break-all mt-0.5">
                        {order.payment_reference}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Contact card — mostly so returning shoppers can
                confirm we have the right email before sending
                support requests. */}
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-serif text-base sm:text-lg font-medium mb-3">Contact</h2>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Email
                    </dt>
                    <dd className="text-foreground mt-0.5 break-all">{order.email}</dd>
                  </div>
                  {order.phone && (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Phone
                      </dt>
                      <dd className="text-foreground mt-0.5">{order.phone}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
