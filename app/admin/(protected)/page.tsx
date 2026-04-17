import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [ordersRes, productsRes, revenueRes, recentOrdersRes] = await Promise.all([
    supabase.from("orders").select("id, status", { count: "exact" }),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("total").neq("status", "cancelled"),
    supabase
      .from("orders")
      .select("id, order_number, email, first_name, last_name, status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const totalOrders = ordersRes.count ?? 0
  const totalProducts = productsRes.count ?? 0
  const totalRevenue = (revenueRes.data ?? []).reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const processing = (ordersRes.data ?? []).filter((o) => o.status === "processing").length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your store</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} label="Total Orders" value={totalOrders.toString()} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Processing" value={processing.toString()} />
        <StatCard icon={<Package className="w-5 h-5" />} label="Products" value={totalProducts.toString()} />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentOrdersRes.data && recentOrdersRes.data.length > 0 ? (
          <div className="space-y-2">
            {recentOrdersRes.data.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground">{order.order_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {order.first_name} {order.last_name} &middot; {order.email}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  <div className="font-semibold text-foreground">${Number(order.total).toFixed(2)}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No orders yet.</p>
        )}
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </Card>
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
