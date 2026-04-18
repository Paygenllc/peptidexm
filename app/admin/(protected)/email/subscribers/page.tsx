import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Mail, Search, Users, UserCheck, UserX } from "lucide-react"
import { toggleNewsletterAction } from "@/app/admin/actions/customers"

export const dynamic = "force-dynamic"

type Filter = "subscribed" | "unsubscribed" | "all"

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: Filter }>
}) {
  const { q = "", filter = "subscribed" } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, newsletter_subscribed, banned_at, last_seen_at, created_at")
    .not("email", "is", null)
    .order("created_at", { ascending: false })

  if (filter === "subscribed") query = query.eq("newsletter_subscribed", true)
  else if (filter === "unsubscribed") query = query.eq("newsletter_subscribed", false)

  if (q.trim()) {
    const term = `%${q.trim()}%`
    query = query.or(`email.ilike.${term},full_name.ilike.${term}`)
  }

  const [{ data: rows }, totalsRes] = await Promise.all([
    query.limit(500),
    supabase.from("profiles").select("newsletter_subscribed, banned_at"),
  ])

  const totals = totalsRes.data ?? []
  const totalSubscribed = totals.filter((p) => p.newsletter_subscribed && !p.banned_at).length
  const totalUnsubscribed = totals.filter((p) => !p.newsletter_subscribed).length
  const totalAll = totals.length

  const list = rows ?? []

  return (
    <div className="space-y-6">
      <Link
        href="/admin/email"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to broadcasts
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-6 h-6" /> Subscribers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everyone who will receive broadcasts sent to the Subscribers audience.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          href="/admin/email/subscribers?filter=subscribed"
          active={filter === "subscribed"}
          icon={<UserCheck className="w-4 h-4" />}
          label="Subscribed"
          count={totalSubscribed}
        />
        <StatCard
          href="/admin/email/subscribers?filter=unsubscribed"
          active={filter === "unsubscribed"}
          icon={<UserX className="w-4 h-4" />}
          label="Unsubscribed"
          count={totalUnsubscribed}
        />
        <StatCard
          href="/admin/email/subscribers?filter=all"
          active={filter === "all"}
          icon={<Users className="w-4 h-4" />}
          label="All customers"
          count={totalAll}
        />
      </div>

      {/* GET form so the URL is sharable and back/forward works */}
      <form method="get" className="flex items-center gap-2">
        <input type="hidden" name="filter" value={filter} />
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search email or name"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border text-left">
              <tr>
                <th className="p-3 font-medium text-muted-foreground">Customer</th>
                <th className="p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground">Joined</th>
                <th className="p-3 font-medium text-muted-foreground text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    No results for these filters.
                  </td>
                </tr>
              )}
              {list.map((p) => {
                const subscribed = !!p.newsletter_subscribed
                const banned = !!p.banned_at
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-accent/30"
                  >
                    <td className="p-3">
                      <div className="font-medium text-foreground truncate max-w-[260px]">
                        {p.full_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                        {p.email}
                      </div>
                    </td>
                    <td className="p-3 space-x-2 whitespace-nowrap">
                      <Badge variant={subscribed ? "default" : "outline"} className="capitalize">
                        {subscribed ? "Subscribed" : "Unsubscribed"}
                      </Badge>
                      {banned && (
                        <Badge variant="destructive" className="capitalize">
                          Banned
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <form action={toggleNewsletterAction}>
                        <input type="hidden" name="userId" value={p.id} />
                        <input type="hidden" name="subscribe" value={(!subscribed).toString()} />
                        <Button
                          type="submit"
                          variant={subscribed ? "outline" : "default"}
                          size="sm"
                        >
                          {subscribed ? "Unsubscribe" : "Subscribe"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {list.length === 500 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing the most recent 500 matches. Refine your search to see more.
        </p>
      )}
    </div>
  )
}

function StatCard({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <Link href={href} className="block">
      <Card
        className={`p-4 sm:p-5 transition-colors ${
          active ? "ring-2 ring-primary/40 bg-accent/20" : "hover:bg-accent/20"
        }`}
      >
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
            {icon}
          </span>
          <span className="text-xs sm:text-sm font-medium">{label}</span>
        </div>
        <div className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums">{count}</div>
      </Card>
    </Link>
  )
}
