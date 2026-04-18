import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  AlertTriangle,
  Mail,
  ArrowRight,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Compute date range for "last 30 days" comparison window
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    allOrdersRes,
    last30Res,
    productsRes,
    customersRes,
    lowStockRes,
    awaitingVerifyRes,
    unansweredBroadcastRes,
    recentOrdersRes,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, payment_status, total, created_at", { count: "exact" }),
    supabase
      .from("orders")
      .select("total, status, created_at")
      .gte("created_at", since30),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("product_variants")
      .select("id, variant_name, stock, product_id, products(name)")
      .lte("stock", 5)
      .gt("stock", 0)
      .order("stock", { ascending: true })
      .limit(5),
    supabase
      .from("orders")
      .select("id, order_number, email, payment_reference, total, created_at")
      .eq("payment_status", "pending")
      .not("payment_reference", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("email_broadcasts")
      .select("id, status", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase
      .from("orders")
      .select("id, order_number, email, first_name, last_name, status, payment_status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const totalOrders = allOrdersRes.count ?? 0
  const totalProducts = productsRes.count ?? 0
  const totalCustomers = customersRes.count ?? 0
  const draftBroadcasts = unansweredBroadcastRes.count ?? 0

  // Lifetime revenue excluding cancelled / refunded
  const lifetimeRevenue = (allOrdersRes.data ?? [])
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0)

  const last30 = last30Res.data ?? []
  const revenue30 = last30
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const orders30 = last30.length

  const processing = (allOrdersRes.data ?? []).filter((o) => o.status === "processing").length
  const lowStock = lowStockRes.data ?? []
  const awaitingVerify = awaitingVerifyRes.data ?? []

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Store overview — last 30 days in context
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Revenue (30d)"
          value={`$${revenue30.toFixed(2)}`}
          sublabel={`$${lifetimeRevenue.toFixed(2)} all time`}
        />
        <StatCard
          icon={<ShoppingCart className="w-4 h-4" />}
          label="Orders (30d)"
          value={orders30.toString()}
          sublabel={`${totalOrders} all time`}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Processing"
          value={processing.toString()}
          sublabel="awaiting fulfillment"
          href="/admin/orders?status=processing"
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Customers"
          value={totalCustomers.toString()}
          sublabel="total accounts"
          href="/admin/customers"
        />
      </div>

      {/* Action-required row — only shows what actually needs attention */}
      {(awaitingVerify.length > 0 || lowStock.length > 0 || draftBroadcasts > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {awaitingVerify.length > 0 && (
            <ActionCard
              tone="amber"
              icon={<AlertTriangle className="w-4 h-4" />}
              title={`${awaitingVerify.length} payment${awaitingVerify.length === 1 ? "" : "s"} to verify`}
              description="Customers submitted Zelle references — confirm the transfer arrived, then mark paid."
              href="/admin/orders?payment=awaiting"
            >
              <ul className="mt-3 space-y-1.5 text-sm">
                {awaitingVerify.slice(0, 3).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs hover:underline truncate">
                      {o.order_number}
                    </Link>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      ${Number(o.total).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </ActionCard>
          )}

          {lowStock.length > 0 && (
            <ActionCard
              tone="slate"
              icon={<Package className="w-4 h-4" />}
              title={`${lowStock.length} variant${lowStock.length === 1 ? "" : "s"} running low`}
              description="Stock at 5 or fewer. Restock before orders hit zero."
              href="/admin/products"
            >
              <ul className="mt-3 space-y-1.5 text-sm">
                {lowStock.slice(0, 3).map((v) => {
                  // The generated type for `products(name)` comes back as an array shape even
                  // though it's a single row per FK, so we handle both defensively.
                  const joined = (v as unknown as { products: { name?: string } | { name?: string }[] | null })
                    .products
                  const productName = Array.isArray(joined)
                    ? joined[0]?.name ?? "Product"
                    : joined?.name ?? "Product"
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {productName} <span className="text-muted-foreground">· {v.variant_name}</span>
                      </span>
                      <span className="tabular-nums text-amber-700 shrink-0">{v.stock} left</span>
                    </li>
                  )
                })}
              </ul>
            </ActionCard>
          )}

          {draftBroadcasts > 0 && (
            <ActionCard
              tone="slate"
              icon={<Mail className="w-4 h-4" />}
              title={`${draftBroadcasts} draft broadcast${draftBroadcasts === 1 ? "" : "s"}`}
              description="Finish and send your email campaigns to reach customers."
              href="/admin/email"
            />
          )}
        </div>
      )}

      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentOrdersRes.data && recentOrdersRes.data.length > 0 ? (
          <div className="space-y-1">
            {recentOrdersRes.data.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md hover:bg-accent transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{order.order_number}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {order.first_name} {order.last_name} · {order.email}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                  <Badge variant={statusVariant(order.status)} className="capitalize">
                    {order.status}
                  </Badge>
                  <Badge variant={order.payment_status === "paid" ? "default" : "outline"} className="capitalize">
                    {order.payment_status}
                  </Badge>
                  <div className="font-semibold text-foreground tabular-nums">
                    ${Number(order.total).toFixed(2)}
                  </div>
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

function StatCard({
  icon,
  label,
  value,
  sublabel,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  href?: string
}) {
  const inner = (
    <Card className="p-4 sm:p-5 h-full hover:bg-accent/40 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
          {icon}
        </span>
        <span className="text-xs sm:text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums break-all">
        {value}
      </div>
      {sublabel && <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">{sublabel}</div>}
    </Card>
  )
  return href ? (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {inner}
    </Link>
  ) : (
    inner
  )
}

function ActionCard({
  icon,
  title,
  description,
  href,
  tone,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  tone: "amber" | "slate"
  children?: React.ReactNode
}) {
  const toneStyles =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-border bg-card"
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-lg border ${toneStyles} p-4 sm:p-5 hover:-translate-y-0.5 transition-transform`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/80 border border-border">
            {icon}
          </span>
          <h3 className="font-semibold text-sm sm:text-base text-balance">{title}</h3>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-pretty">{description}</p>
      {children}
    </Link>
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
