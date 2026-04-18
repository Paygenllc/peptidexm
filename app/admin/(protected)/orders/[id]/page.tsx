import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import { OrderStatusForm } from "./order-status-form"

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

        <div>
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            currentPayment={order.payment_status}
            currentTracking={order.tracking_number}
            currentCarrier={order.tracking_carrier}
            currentNotes={order.notes}
          />
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
