import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, ShieldCheck, Ban, Mail, Users } from "lucide-react"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{ q?: string; filter?: string }>

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, filter } = await searchParams
  const supabase = await createClient()

  // Build filtered query. For server-side text search we use Postgres `ilike`
  // across email + full_name so the admin can find a user by either.
  let query = supabase
    .from("profiles")
    .select(
      "id, email, full_name, is_admin, banned_at, newsletter_subscribed, created_at, last_seen_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    query = query.or(`email.ilike.${like},full_name.ilike.${like}`)
  }
  if (filter === "admins") query = query.eq("is_admin", true)
  else if (filter === "banned") query = query.not("banned_at", "is", null)
  else if (filter === "subscribed") query = query.eq("newsletter_subscribed", true)

  const [profilesRes, totalsRes] = await Promise.all([
    query,
    supabase.from("profiles").select("is_admin, banned_at, newsletter_subscribed"),
  ])

  const profiles = profilesRes.data ?? []
  const totals = totalsRes.data ?? []
  const totalCustomers = totals.length
  const totalAdmins = totals.filter((p) => p.is_admin).length
  const totalBanned = totals.filter((p) => p.banned_at).length
  const totalSubscribed = totals.filter((p) => p.newsletter_subscribed).length

  const filterLinks: Array<{ label: string; value?: string; count: number }> = [
    { label: "All", count: totalCustomers },
    { label: "Admins", value: "admins", count: totalAdmins },
    { label: "Banned", value: "banned", count: totalBanned },
    { label: "Subscribed", value: "subscribed", count: totalSubscribed },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCustomers} total · {totalAdmins} admin · {totalSubscribed} subscribed · {totalBanned} banned
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <form className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by email or name…"
              className="pl-9"
            />
            {filter && <input type="hidden" name="filter" value={filter} />}
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filterLinks.map((f) => {
            const active = (filter ?? undefined) === f.value
            const href = buildHref({ q, filter: f.value })
            return (
              <Link
                key={f.label}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-secondary"
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${active ? "opacity-70" : "text-muted-foreground"}`}>
                  {f.count}
                </span>
              </Link>
            )
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border text-left">
              <tr>
                <th className="p-3 font-medium text-muted-foreground">Customer</th>
                <th className="p-3 font-medium text-muted-foreground">Signed up</th>
                <th className="p-3 font-medium text-muted-foreground">Roles</th>
                <th className="p-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No customers match your filters.
                  </td>
                </tr>
              )}
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3">
                    <div className="font-medium text-foreground">{p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">{p.email}</div>
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.is_admin && (
                        <Badge className="gap-1">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </Badge>
                      )}
                      {p.banned_at && (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="w-3 h-3" /> Banned
                        </Badge>
                      )}
                      {p.newsletter_subscribed && (
                        <Badge variant="outline" className="gap-1">
                          <Mail className="w-3 h-3" /> Subscribed
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/customers/${p.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Manage
                    </Link>
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

// Build query-string-preserving hrefs so filter pills and search can stack.
function buildHref({ q, filter }: { q?: string; filter?: string }) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (filter) params.set("filter", filter)
  const qs = params.toString()
  return qs ? `/admin/customers?${qs}` : "/admin/customers"
}
