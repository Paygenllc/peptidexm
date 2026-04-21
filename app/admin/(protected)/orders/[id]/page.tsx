import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Compass } from "lucide-react"
import { OrderStatusForm } from "./order-status-form"
import { PaymentReminderButton } from "./payment-reminder-button"
import { DeleteOrderButton } from "./delete-order-button"
import { sourceLabel, type SourceChannel } from "@/lib/traffic-source"

export const dynamic = "force-dynamic"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single()
  if (!order) notFound()

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: true })

  const { data: history } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Back to orders
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{order.order_number}</h1>
          <p className="text-muted-foreground mt-1">
            Placed on{" "}
            {new Date(order.created_at).toLocaleString("en-US", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(order.status)} className="text-sm">
            {order.status}
          </Badge>
          <Badge variant={order.payment_status === "paid" ? "default" : "outline"} className="text-sm">
            Payment: {order.payment_status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-foreground mb-4">Items</h2>
            <div className="space-y-3">
              {items?.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{item.product_name}</div>
                    <div className="text-sm text-muted-foreground">{item.variant_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ${Number(item.unit_price).toFixed(2)} &times; {item.quantity}
                    </div>
                  </div>
                  <div className="font-semibold text-foreground">${Number(item.line_total).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={`$${Number(order.subtotal).toFixed(2)}`} />
              <Row label="Shipping" value={`$${Number(order.shipping).toFixed(2)}`} />
              <Row label="Tax" value={`$${Number(order.tax).toFixed(2)}`} />
              <Separator className="my-2" />
              <Row label="Total" value={`$${Number(order.total).toFixed(2)}`} bold />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground mb-4">Payment</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <Field label="Method" value={(order.payment_method || "zelle").toUpperCase()} />
              <Field label="Status" value={order.payment_status} />
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">Customer reference</dt>
                <dd className="text-foreground mt-0.5 font-mono text-xs break-all">
                  {order.payment_reference ? (
                    order.payment_reference
                  ) : (
                    <span className="font-sans text-muted-foreground italic">Not submitted yet</span>
                  )}
                </dd>
              </div>
              {order.payment_submitted_at && (
                <Field
                  label="Submitted at"
                  value={new Date(order.payment_submitted_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              )}
            </dl>
            {order.payment_reference && order.payment_status !== "paid" && (
              <p className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                Customer submitted a Zelle reference. Verify the transfer arrived at peptidexm@gmail.com, then mark
                Payment as <span className="font-semibold">paid</span> in the panel on the right.
              </p>
            )}

            {/*
             * Payment reminder sender. The button self-hides for
             * non-pending orders so we never offer to nudge someone
             * who already paid. The cron runs this exact same action
             * in the background, so operator-triggered sends still
             * count toward the 3-reminder cap.
             */}
            {order.payment_status === "pending" && (
              <div className="mt-5 pt-4 border-t border-border">
                <div className="mb-2">
                  <p className="text-sm font-medium text-foreground">Payment reminder</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Emails the customer their Zelle details again. Automatic reminders run daily; this sends one now.
                  </p>
                </div>
                <PaymentReminderButton
                  orderId={order.id}
                  paymentStatus={order.payment_status}
                  reminderCount={order.payment_reminder_count ?? 0}
                  lastSentAt={order.last_payment_reminder_sent_at ?? null}
                />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground mb-4">Customer</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <Field label="Name" value={`${order.first_name} ${order.last_name}`} />
              <Field label="Email" value={order.email} />
              <Field label="Phone" value={order.phone || "-"} />
            </dl>
            <Separator className="my-4" />
            <h3 className="font-medium text-foreground mb-2">Shipping Address</h3>
            <address className="not-italic text-sm text-muted-foreground leading-relaxed">
              {order.address_line1}
              <br />
              {order.address_line2 && (
                <>
                  {order.address_line2}
                  <br />
                </>
              )}
              {order.city}, {order.state} {order.zip_code}
              <br />
              {order.country}
            </address>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Compass className="w-4 h-4 text-muted-foreground" />
              Traffic source
            </h2>
            {order.source_channel ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <Field
                  label="Channel"
                  value={sourceLabel(order.source_channel as SourceChannel)}
                />
                <Field label="Landing page" value={order.landing_path || "—"} />
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground uppercase tracking-wide">Referrer</dt>
                  <dd className="text-foreground mt-0.5 break-all">
                    {order.referrer ? (
                      <a
                        href={order.referrer}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary hover:underline"
                      >
                        {order.referrer}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">None (typed / bookmarked)</span>
                    )}
                  </dd>
                </div>
                {(order.utm_source || order.utm_medium || order.utm_campaign) && (
                  <div className="sm:col-span-2 pt-2 border-t border-border">
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Campaign tags</dt>
                    <dd className="flex flex-wrap gap-2 text-xs">
                      {order.utm_source && (
                        <Badge variant="secondary">source: {order.utm_source}</Badge>
                      )}
                      {order.utm_medium && (
                        <Badge variant="secondary">medium: {order.utm_medium}</Badge>
                      )}
                      {order.utm_campaign && (
                        <Badge variant="secondary">campaign: {order.utm_campaign}</Badge>
                      )}
                      {order.utm_term && <Badge variant="secondary">term: {order.utm_term}</Badge>}
                      {order.utm_content && (
                        <Badge variant="secondary">content: {order.utm_content}</Badge>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No attribution captured. Orders placed before attribution was enabled (or by shoppers
                who blocked cookies) will show this message.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground mb-4">Status History</h2>
            {history && history.length > 0 ? (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <div className="font-medium text-foreground capitalize">{h.status}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                      {h.notes && <div className="text-xs text-muted-foreground mt-1">{h.notes}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No status changes recorded.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            currentPayment={order.payment_status}
            currentTracking={order.tracking_number}
            currentCarrier={order.tracking_carrier}
            currentTrackingUrl={order.tracking_url}
            currentNotes={order.notes}
          />
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Danger zone
            </div>
            <DeleteOrderButton orderId={order.id} orderNumber={order.order_number} />
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-semibold text-foreground text-base" : "text-foreground"}>{value}</span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="text-foreground mt-0.5">{value}</dd>
    </div>
  )
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "delivered":
      return "default"
    case "shipped":
    case "confirmed":
      return "secondary"
    case "cancelled":
    case "refunded":
      return "destructive"
    default:
      return "outline"
  }
}
