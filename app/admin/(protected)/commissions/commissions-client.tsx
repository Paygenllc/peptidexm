"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  DollarSign,
  Users,
  Receipt,
  Download,
  Percent,
} from "lucide-react"
import type { AffiliateRow, RedemptionRow } from "./types"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

interface Props {
  fromIso: string
  toIso: string
  includeUnpaid: boolean
  affiliates: AffiliateRow[]
  redemptions: RedemptionRow[]
  totals: {
    redemptions: number
    discount: number
    base: number
    commission: number
  }
}

export function CommissionsClient({
  fromIso,
  toIso,
  includeUnpaid,
  affiliates,
  redemptions,
  totals,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  // Date inputs use the YYYY-MM-DD slice of the ISO strings — the
  // server already normalised the boundaries (00:00 / 23:59:59) so
  // we don't have to round-trip timezone math here.
  const [from, setFrom] = useState(fromIso.slice(0, 10))
  const [to, setTo] = useState(toIso.slice(0, 10))

  const applyFilters = (next: { from?: string; to?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (next.from !== undefined) {
      next.from ? params.set("from", next.from) : params.delete("from")
    }
    if (next.to !== undefined) {
      next.to ? params.set("to", next.to) : params.delete("to")
    }
    if (next.status !== undefined) {
      next.status === "all"
        ? params.set("status", "all")
        : params.delete("status")
    }
    startTransition(() => {
      router.push(`/admin/commissions?${params.toString()}`)
    })
  }

  // CSV export uses the currently-visible rows so the file always
  // matches what the admin sees. Built in-browser to avoid an extra
  // round-trip — payload is tiny (one row per redemption).
  const csvHref = useMemo(() => {
    const headers = [
      "Date",
      "Order #",
      "Order status",
      "Payment",
      "Affiliate",
      "Affiliate email",
      "Coupon",
      "Rate %",
      "Subtotal at redemption",
      "Discount given",
      "Commissionable base",
      "Commission",
    ]
    const lines = [headers.join(",")]
    for (const r of redemptions) {
      lines.push(
        [
          new Date(r.createdAt).toISOString(),
          csv(r.orderNumber ?? ""),
          csv(r.orderStatus ?? ""),
          csv(r.paymentStatus ?? ""),
          csv(r.affiliateName ?? ""),
          csv(r.affiliateEmail ?? ""),
          csv(r.couponCode),
          r.commissionRatePercent.toFixed(2),
          r.subtotalAtRedemption.toFixed(2),
          r.amountOff.toFixed(2),
          r.commissionableBase.toFixed(2),
          r.commission.toFixed(2),
        ].join(","),
      )
    }
    return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`
  }, [redemptions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold text-foreground">
            Affiliate commissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live earnings ledger derived from affiliate coupon redemptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <a href={csvHref} download={`commissions-${from}-to-${to}.csv`}>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
              />
            </div>
            <Button
              onClick={() => applyFilters({ from, to })}
              disabled={pending}
            >
              {pending ? "Loading…" : "Apply"}
            </Button>
            <div className="flex items-center gap-3 sm:justify-end">
              <Label
                htmlFor="includeUnpaid"
                className="text-sm font-normal text-muted-foreground cursor-pointer"
              >
                Include unpaid orders
              </Label>
              <Switch
                id="includeUnpaid"
                checked={includeUnpaid}
                onCheckedChange={(checked) =>
                  applyFilters({ status: checked ? "all" : "" })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Commission owed"
          value={usd.format(totals.commission)}
          accent
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Redemptions"
          value={String(totals.redemptions)}
        />
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label="Discounts given"
          value={usd.format(totals.discount)}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active affiliates"
          value={String(affiliates.length)}
        />
      </div>

      {/* Per-affiliate / per-redemption views */}
      <Tabs defaultValue="affiliates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="affiliates">By affiliate</TabsTrigger>
          <TabsTrigger value="redemptions">By redemption</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Earnings by affiliate</CardTitle>
              <CardDescription>
                Sorted by commission earned in the selected window.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Codes</TableHead>
                    <TableHead className="text-right">Redemptions</TableHead>
                    <TableHead className="text-right">
                      Discounts given
                    </TableHead>
                    <TableHead className="text-right">
                      Commissionable
                    </TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-10"
                      >
                        No commissionable redemptions in this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    affiliates.map((a) => (
                      <TableRow key={a.name}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {a.name}
                            </span>
                            {a.email && (
                              <span className="text-xs text-muted-foreground">
                                {a.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {a.couponCodes.map((c) => (
                              <Badge
                                key={c}
                                variant="secondary"
                                className="font-mono text-xs"
                              >
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.redemptions}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {usd.format(a.totalDiscountGiven)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {usd.format(a.totalCommissionableBase)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-foreground">
                          {usd.format(a.totalCommission)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Individual redemptions</CardTitle>
              <CardDescription>
                One row per coupon use. Newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">
                      Commissionable
                    </TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground py-10"
                      >
                        No redemptions in this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    redemptions.map((r) => (
                      <TableRow key={r.redemptionId}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {dateTime.format(new Date(r.createdAt))}
                        </TableCell>
                        <TableCell>
                          {r.orderId && r.orderNumber ? (
                            <Link
                              href={`/admin/orders/${r.orderId}`}
                              className="text-foreground hover:underline font-medium"
                            >
                              #{r.orderNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {!r.isPaid && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400"
                            >
                              {r.paymentStatus ?? "unpaid"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.affiliateName ?? (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">
                            {r.couponCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.commissionRatePercent}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {usd.format(r.commissionableBase)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {usd.format(r.commission)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          {icon}
          <span>{label}</span>
        </div>
        <p
          className={`mt-2 text-2xl font-semibold tabular-nums ${
            accent ? "text-foreground" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Minimal CSV-safe quoting. Wraps a value in double quotes when it
 * contains a comma, quote, or newline; escapes inner quotes by
 * doubling them. Good enough for an export-yourself flow — no need
 * to pull in a CSV library.
 */
function csv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
