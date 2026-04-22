import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "@/app/admin/actions/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, LogOut, ShieldCheck, Truck, ExternalLink, ChevronRight } from "lucide-react"
import { ZellePaymentPanel } from "@/components/zelle-payment-panel"
// Carrier lookup: detects USPS/UPS/FedEx/DHL from the tracking
// number format when the admin didn't pick one, and produces a deep
// link to the carrier's own tracking page so customers click once
// and see live transit status.
import { resolveCarrierInfo } from "@/lib/carrier"

export const metadata = {
  title: "My Account",
  description: "Manage your PeptideXM account and view your order history.",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processing: "secondary",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
  refunded: "outline",
  pending: "secondary",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Customer-friendly URL — same form/action as /admin/login but
    // the URL bar doesn't scream "admin" at a regular shopper.
    redirect("/signin?error=auth_required")
  }

  const userEmail = (user.email ?? "").toLowerCase()

  // Match orders by user_id OR by matching email (case-insensitive).
  // The trigger `link_guest_orders_to_new_user` back-links guest orders on
  // signup, but this OR query also catches orders placed in the same session
  // before the trigger fires and any with slight email casing differences.
  // Same projection for both query branches — extracted here so the
  // tracking columns stay in sync with the detail page query.
  const ORDER_LIST_COLS =
    "id, order_number, created_at, status, payment_status, payment_method, payment_reference, total, email, tracking_number, tracking_carrier, tracking_url, order_items(id, product_name, variant_name, quantity)"

  const ordersQuery = userEmail
    ? supabase
        .from("orders")
        .select(ORDER_LIST_COLS)
        .or(`user_id.eq.${user.id},email.ilike.${userEmail}`)
        .order("created_at", { ascending: false })
    : supabase
        .from("orders")
        .select(ORDER_LIST_COLS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, is_admin").eq("id", user.id).single(),
    ordersQuery,
  ])

  const displayName = profile?.full_name?.trim() || user.email?.split("@")[0] || "there"

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to shop</span>
          </Link>
          <div className="flex items-center gap-2">
            {profile?.is_admin && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href="/admin">
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              </Button>
            )}
            <form action={logoutAction}>
              <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>

        {/* Greeting */}
        <div className="mb-8 sm:mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-balance">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 break-all">{user.email}</p>
        </div>

        {/* Orders */}
        <section aria-labelledby="orders-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="orders-heading" className="font-serif text-xl sm:text-2xl font-medium">
              Order history
            </h2>
            <span className="text-sm text-muted-foreground">
              {orders?.length ?? 0} {orders?.length === 1 ? "order" : "orders"}
            </span>
          </div>

          {!orders || orders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 sm:p-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl mb-2">No orders yet</h3>
                <p className="text-sm text-muted-foreground mb-6 text-pretty">
                  When you place your first order it will show up here.
                </p>
                <Button asChild className="h-11">
                  <Link href="/#products">Browse products</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {orders.map((order) => {
                const items = order.order_items ?? []
                const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
                const status = (order.status || "processing").toLowerCase()
                const paymentStatus = (order.payment_status || "pending").toLowerCase()
                // Resolve the carrier + deep tracking link once per
                // card so the summary row and the tracking strip both
                // reference the same URL.
                const tracking = resolveCarrierInfo(
                  order.tracking_number,
                  order.tracking_carrier,
                  order.tracking_url,
                )
                return (
                  <Card key={order.id} className="group transition-shadow hover:shadow-md">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Order number links to the detail page.
                                Block-level link would be nicer for
                                clickable-area, but we have inline
                                controls (Zelle panel, external
                                tracking link) so a focused anchor on
                                the order number is the safer pattern. */}
                            <Link
                              href={`/account/orders/${encodeURIComponent(order.order_number)}`}
                              className="font-medium text-base sm:text-lg text-foreground break-all hover:text-accent transition-colors underline-offset-4 hover:underline"
                            >
                              {order.order_number}
                            </Link>
                            <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className="capitalize">
                              {status}
                            </Badge>
                            <Badge
                              variant={paymentStatus === "paid" ? "default" : "outline"}
                              className="capitalize"
                            >
                              {paymentStatus}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Placed {formatDate(order.created_at)} · {itemCount}{" "}
                            {itemCount === 1 ? "item" : "items"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-serif text-xl sm:text-2xl text-foreground tabular-nums">
                            ${Number(order.total).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {items.length > 0 && (
                        <ul className="space-y-1 text-sm">
                          {items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-baseline justify-between gap-3 text-muted-foreground"
                            >
                              <span className="truncate">
                                {item.product_name}
                                {item.variant_name ? (
                                  <span className="text-muted-foreground/80"> · {item.variant_name}</span>
                                ) : null}
                              </span>
                              <span className="shrink-0 tabular-nums">× {item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Tracking strip — only rendered when the
                          order has a tracking number. Puts the
                          carrier + number front-and-centre with a
                          one-click deep link to the carrier's own
                          web tracker (auto-detected from the number
                          format if the admin didn't pick one). */}
                      {tracking && (
                        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 sm:p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                              <Truck className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {tracking.label} tracking
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
                                {order.tracking_number}
                              </p>
                            </div>
                            {tracking.trackingUrl && (
                              <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                                <a
                                  href={tracking.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Track this package on ${tracking.label}'s website`}
                                >
                                  Track
                                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Zelle payment for orders awaiting payment */}
                      {paymentStatus === "pending" && !order.payment_reference && status !== "cancelled" && (
                        <div className="mt-5 pt-5 border-t border-border">
                          <ZellePaymentPanel
                            orderNumber={order.order_number}
                            total={Number(order.total)}
                            customerEmail={order.email ?? user.email ?? ""}
                          />
                        </div>
                      )}

                      {/* Reference submitted, awaiting verification */}
                      {order.payment_reference && paymentStatus !== "paid" && (
                        <div className="mt-4 rounded-lg bg-secondary/60 border border-border p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">Payment reference submitted</p>
                              <p className="text-muted-foreground font-mono text-xs break-all mt-0.5">
                                {order.payment_reference}
                              </p>
                              <p className="text-muted-foreground text-xs mt-1">
                                We&apos;ll verify the Zelle transfer and ship shortly.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer link to the full detail view — full
                          itemized receipt, shipping address, all
                          payment metadata, and the large tracking
                          banner live there. */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <Link
                          href={`/account/orders/${encodeURIComponent(order.order_number)}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group/link"
                        >
                          View full order details
                          <ChevronRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
