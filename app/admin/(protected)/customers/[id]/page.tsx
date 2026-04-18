import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Mail, Calendar, ShieldCheck, Ban } from "lucide-react"
import { CustomerActions } from "./customer-actions"

export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [profileRes, ordersRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("orders")
      .select("id, order_number, status, payment_status, total, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
  ])

  const profile = profileRes.data
  if (!profile) notFound()

  const orders = ordersRes.data ?? []
  const lifetimeSpend = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + Number(o.total), 0)

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to customers
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
            {profile.full_name || profile.email}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {profile.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Signed up{" "}
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {profile.is_admin && (
            <Badge className="gap-1">
              <ShieldCheck className="w-3 h-3" /> Admin
            </Badge>
          )}
          {profile.banned_at && (
            <Badge variant="destructive" className="gap-1">
              <Ban className="w-3 h-3" /> Banned
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Order history</h2>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">${lifetimeSpend.toFixed(2)}</span>{" "}
                lifetime · {orders.length} order{orders.length === 1 ? "" : "s"}
              </div>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">This customer has no orders yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-accent/30 -mx-4 px-4 sm:-mx-6 sm:px-6 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground text-sm font-mono">{o.order_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="capitalize">
                        {o.status}
                      </Badge>
                      <div className="font-semibold text-foreground tabular-nums">
                        ${Number(o.total).toFixed(2)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="p-4 sm:p-6 space-y-5 lg:sticky lg:top-8">
            <h2 className="font-semibold text-foreground">Actions</h2>
            <div className="space-y-4 text-sm">
              <FieldRow label="User id" value={<span className="font-mono text-xs break-all">{profile.id}</span>} />
              <FieldRow
                label="Last seen"
                value={
                  profile.last_seen_at
                    ? new Date(profile.last_seen_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"
                }
              />
              <FieldRow
                label="Newsletter"
                value={profile.newsletter_subscribed ? "Subscribed" : "Unsubscribed"}
              />
            </div>
            <Separator />
            <CustomerActions
              userId={profile.id}
              isAdmin={!!profile.is_admin}
              isBanned={!!profile.banned_at}
              isSubscribed={!!profile.newsletter_subscribed}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  )
}
