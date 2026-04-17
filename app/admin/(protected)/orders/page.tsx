import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUSES = ["all", "processing", "confirmed", "shipped", "delivered", "cancelled", "refunded"] as const

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const status = params.status ?? "all"
  const q = params.q ?? ""

  const supabase = await createClient()
  let query = supabase
    .from("orders")
    .select("id, order_number, email, first_name, last_name, status, payment_status, total, created_at")
    .order("created_at", { ascending: false })

  if (status !== "all") {
    query = query.eq("status", status)
  }
  if (q) {
    query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
  }

  const { data: orders, error } = await query.limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage and track all customer orders</p>
      </div>

      <Card className="p-4">
        <form className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search order number, email, name..." className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={{ query: { ...(q ? { q } : {}), ...(s !== "all" ? { status: s } : {}) } }}
                className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Order #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-destructive">
                    {error.message}
                  </td>
                </tr>
              )}
              {!error && orders && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No orders found.
                  </td>
                </tr>
              )}
              {orders?.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-medium text-foreground">
                      {order.first_name} {order.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{order.email}</div>
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge variant={order.payment_status === "paid" ? "default" : "outline"}>
                      {order.payment_status}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  </td>
                  <td className="p-3 text-right font-semibold text-foreground whitespace-nowrap">
                    ${Number(order.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
