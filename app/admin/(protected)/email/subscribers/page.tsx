import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Mail, Search, Users, UserCheck, UserX, Trash2 } from "lucide-react"
import { toggleNewsletterAction } from "@/app/admin/actions/customers"
import { removeStandaloneSubscriberAction } from "@/app/admin/actions/subscribers"
import { Pagination, parsePage } from "@/components/admin/pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 25

type Filter = "subscribed" | "unsubscribed" | "all"

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: Filter; page?: string; spage?: string }>
}) {
  const { q = "", filter = "subscribed", page: pageRaw, spage: spageRaw } = await searchParams
  // Two independent paginators on one page — profiles and the separate
  // "Newsletter signups" table — so we use two distinct page keys.
  const page = parsePage(pageRaw)
  const spage = parsePage(spageRaw)
  const supabase = await createClient()

  let query = supabase
    .from("profiles")
    .select(
      "id, email, full_name, newsletter_subscribed, banned_at, last_seen_at, created_at",
      { count: "exact" },
    )
    .not("email", "is", null)
    .order("created_at", { ascending: false })

  if (filter === "subscribed") query = query.eq("newsletter_subscribed", true)
  else if (filter === "unsubscribed") query = query.eq("newsletter_subscribed", false)

  if (q.trim()) {
    const term = `%${q.trim()}%`
    query = query.or(`email.ilike.${term},full_name.ilike.${term}`)
  }

  const from = (page - 1) * PAGE_SIZE

  const [profilesRes, totalsRes, standaloneRes, profileEmailsRes] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("profiles").select("newsletter_subscribed, banned_at"),
    // Pull the full standalone list (still capped at 1k) so we can dedupe
    // against profile emails before paginating client-side. The table is
    // small enough — a few thousand newsletter-only signups at most —
    // that one trip is simpler and faster than a two-phase dedupe.
    supabase
      .from("newsletter_subscribers")
      .select("id, email, source, subscribed_at")
      .is("unsubscribed_at", null)
      .order("subscribed_at", { ascending: false })
      .limit(1000),
    supabase.from("profiles").select("email").not("email", "is", null),
  ])

  const list = profilesRes.data ?? []
  const totalFiltered = profilesRes.count ?? 0
  const totals = totalsRes.data ?? []
  const totalSubscribed = totals.filter((p) => p.newsletter_subscribed && !p.banned_at).length
  const totalUnsubscribed = totals.filter((p) => !p.newsletter_subscribed).length
  const totalAll = totals.length

  const standaloneRaw = standaloneRes.data ?? []
  const profileEmails = new Set<string>()
  for (const p of profileEmailsRes.data ?? []) {
    if (p.email) profileEmails.add(p.email.toLowerCase())
  }
  // Hide standalone rows whose email also exists on a profile — they'll
  // already show up in the "subscribed customers" table above.
  const standalone = standaloneRaw.filter(
    (s) => s.email && !profileEmails.has(s.email.toLowerCase()),
  )

  const filteredStandalone = q.trim()
    ? standalone.filter((s) => s.email?.toLowerCase().includes(q.trim().toLowerCase()))
    : standalone
  // Slice the standalone list for the current "spage" — separate pager.
  const standaloneTotal = filteredStandalone.length
  const standaloneStart = (spage - 1) * PAGE_SIZE
  const standalonePage = filteredStandalone.slice(standaloneStart, standaloneStart + PAGE_SIZE)

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
                      <form
                        action={async (fd) => {
                          "use server"
                          await toggleNewsletterAction(fd)
                        }}
                      >
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

      <Pagination
        basePath="/admin/email/subscribers"
        params={{ q, filter, spage: spageRaw }}
        page={page}
        pageSize={PAGE_SIZE}
        total={totalFiltered}
      />

      <div className="pt-2">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              Newsletter signups
            </h2>
            <p className="text-sm text-muted-foreground">
              Addresses collected from the public subscribe form who haven&apos;t
              created an account yet. Included automatically when you broadcast
              to the Subscribers audience.
            </p>
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {standaloneTotal}
          </Badge>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 border-b border-border text-left">
                <tr>
                  <th className="p-3 font-medium text-muted-foreground">Email</th>
                  <th className="p-3 font-medium text-muted-foreground">Source</th>
                  <th className="p-3 font-medium text-muted-foreground">Subscribed</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {standalonePage.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      {q.trim()
                        ? "No newsletter signups match your search."
                        : "No standalone newsletter signups yet. They appear here when someone uses the footer form."}
                    </td>
                  </tr>
                )}
                {standalonePage.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-accent/30"
                  >
                    <td className="p-3 font-medium text-foreground truncate max-w-[260px]">
                      {s.email}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {s.source || "unknown"}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {s.subscribed_at
                        ? new Date(s.subscribed_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <form
                        action={async (fd) => {
                          "use server"
                          await removeStandaloneSubscriberAction(fd)
                        }}
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          aria-label={`Remove ${s.email}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Pagination
          basePath="/admin/email/subscribers"
          params={{ q, filter, page: pageRaw }}
          page={spage}
          pageSize={PAGE_SIZE}
          total={standaloneTotal}
          pageKey="spage"
        />
      </div>
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
