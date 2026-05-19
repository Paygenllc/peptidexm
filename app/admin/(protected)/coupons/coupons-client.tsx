"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  X,
  Check,
  Loader2,
  Search,
  Tag,
  Ticket,
  Users,
  Copy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  createCouponAction,
  updateCouponAction,
  deleteCouponAction,
  toggleCouponActiveAction,
  type AdminCouponRow,
} from "@/app/admin/actions/coupons"

/**
 * Form-state shape used by both the "New coupon" and "Edit coupon"
 * dialogs. Numbers are kept as strings so empty inputs round-trip
 * cleanly — we only coerce at submit time.
 */
type FormState = {
  code: string
  type: "percent" | "fixed"
  value: string
  maxUses: string
  maxPerCustomer: string
  minOrderSubtotal: string
  expiresAt: string // datetime-local
  customerEmail: string
  notes: string
  active: boolean
  // Affiliate metadata. Always sent through the form so we don't
  // need a separate code path; the dialog hides the fields when
  // they're irrelevant.
  affiliateName: string
  affiliateEmail: string
  commissionRatePercent: string
  /** Tells `createCouponAction` to tag the row's `source` column. */
  source: "manual" | "affiliate"
}

const EMPTY_FORM: FormState = {
  code: "",
  type: "percent",
  value: "10",
  maxUses: "",
  maxPerCustomer: "",
  minOrderSubtotal: "",
  expiresAt: "",
  customerEmail: "",
  notes: "",
  active: true,
  affiliateName: "",
  affiliateEmail: "",
  commissionRatePercent: "",
  source: "manual",
}

/**
 * Default form state for a brand-new affiliate coupon. Affiliates
 * typically get 20% off for their audience, no max-uses cap (the
 * cap is on commission, not redemptions), one-per-customer to stop
 * stacking, and the `source = "affiliate"` tag for reporting.
 */
const EMPTY_AFFILIATE_FORM: FormState = {
  ...EMPTY_FORM,
  value: "20",
  maxPerCustomer: "1",
  commissionRatePercent: "10",
  source: "affiliate",
}

/**
 * Generate a readable affiliate code from a name, e.g. "Jane Doe" →
 * "JANE20". Falls back to a short random suffix so two affiliates
 * with the same first name don't collide. The admin can always
 * override the suggestion before submitting.
 */
function suggestAffiliateCode(name: string, percent: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ""
  const clean = first.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  const pct = percent.trim() || "20"
  if (!clean) return ""
  return `${clean}${pct}`
}

/** Convert a row from the DB into the form-state shape. */
function rowToForm(row: AdminCouponRow): FormState {
  return {
    code: row.code,
    type: row.type,
    value: String(row.value),
    maxUses: row.max_uses != null ? String(row.max_uses) : "",
    maxPerCustomer: row.max_per_customer != null ? String(row.max_per_customer) : "",
    minOrderSubtotal: row.min_order_subtotal != null ? String(row.min_order_subtotal) : "",
    // datetime-local wants `YYYY-MM-DDTHH:MM` in local time. Trim the
    // trailing seconds + timezone off the ISO string.
    expiresAt: row.expires_at ? row.expires_at.slice(0, 16) : "",
    customerEmail: row.customer_email ?? "",
    notes: row.notes ?? "",
    active: row.active,
    affiliateName: row.affiliate_name ?? "",
    affiliateEmail: row.affiliate_email ?? "",
    commissionRatePercent:
      row.commission_rate_percent != null
        ? String(row.commission_rate_percent)
        : "",
    // Preserve the original `source` on edit so admins can't
    // accidentally re-tag a manual coupon as affiliate (or vice
    // versa) without explicitly meaning to.
    source: (row.source === "affiliate" ? "affiliate" : "manual"),
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatValue(row: AdminCouponRow): string {
  return row.type === "percent"
    ? `${Number(row.value).toFixed(0)}%`
    : `$${Number(row.value).toFixed(2)}`
}

/**
 * Computes a human-readable status pill for the row. We don't store
 * "expired" / "exhausted" as enum values — the underlying truth is
 * derived (active flag + expires_at + redemption_count vs max_uses),
 * so we re-derive it here so the admin sees the *effective* state,
 * not just the active flag.
 */
function statusFor(row: AdminCouponRow): {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
} {
  if (!row.active) return { label: "Inactive", variant: "secondary" }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { label: "Expired", variant: "destructive" }
  }
  if (row.max_uses != null && row.redemption_count >= row.max_uses) {
    return { label: "Exhausted", variant: "destructive" }
  }
  return { label: "Active", variant: "default" }
}

interface Props {
  initialCoupons: AdminCouponRow[]
}

export function CouponsClient({ initialCoupons }: Props) {
  const [coupons, setCoupons] = useState<AdminCouponRow[]>(initialCoupons)
  const [search, setSearch] = useState("")
  const [editingRow, setEditingRow] = useState<AdminCouponRow | null>(null)
  // `creating` carries which preset to open with: `null` = closed,
  // `"manual"` = blank standard coupon, `"affiliate"` = pre-filled
  // 20%-off affiliate template.
  const [creating, setCreating] = useState<"manual" | "affiliate" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminCouponRow | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Status messages live above the table — same pattern the rest of
  // the admin uses (see abandoned-carts-client.tsx). No toaster is
  // mounted in the admin shell, so we render inline.
  const [flash, setFlash] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null)

  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return coupons
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.customer_email ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q),
    )
  }, [coupons, search])

  // Aggregate stats for the small KPI strip up top. These are over
  // the *current* page-load snapshot — admin can refresh for live
  // numbers. Kept lightweight rather than wiring a separate query.
  const stats = useMemo(() => {
    const active = coupons.filter((c) => statusFor(c).label === "Active").length
    const totalRedemptions = coupons.reduce((s, c) => s + c.redemption_count, 0)
    const totalDiscount = coupons.reduce((s, c) => s + Number(c.total_amount_off ?? 0), 0)
    return { active, totalRedemptions, totalDiscount }
  }, [coupons])

  /** Replace or insert one row in the local state by id. */
  function upsertLocal(row: AdminCouponRow) {
    setCoupons((prev) => {
      const idx = prev.findIndex((c) => c.id === row.id)
      if (idx === -1) return [row, ...prev]
      const next = prev.slice()
      next[idx] = row
      return next
    })
  }

  /** Remove one row from the local state. */
  function removeLocal(id: string) {
    setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  function handleToggleActive(row: AdminCouponRow) {
    startTransition(async () => {
      const res = await toggleCouponActiveAction(row.id, !row.active)
      if (res.error) {
        setFlash({ kind: "error", message: res.error })
        return
      }
      if (res.row) upsertLocal(res.row)
      setFlash({
        kind: "success",
        message: `${row.code} is now ${!row.active ? "active" : "inactive"}.`,
      })
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const res = await deleteCouponAction(target.id)
      if (res.error) {
        setFlash({ kind: "error", message: res.error })
        return
      }
      if (res.softDeleted && res.row) {
        // Coupon had redemptions — we soft-disabled it instead.
        upsertLocal(res.row)
        setFlash({
          kind: "success",
          message: `${target.code} had redemptions and was disabled instead of deleted.`,
        })
      } else {
        removeLocal(target.id)
        setFlash({ kind: "success", message: `${target.code} deleted.` })
      }
      setDeleteTarget(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Coupons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create discount codes, lock them to specific customers, and track
            redemptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick-create for partner / influencer codes. Pre-fills 20%
              off, 1-per-customer, and tags source = "affiliate" so the
              row shows up in the affiliate column and reports later. */}
          <Button
            variant="outline"
            onClick={() => setCreating("affiliate")}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            New affiliate coupon
          </Button>
          <Button onClick={() => setCreating("manual")} className="gap-2">
            <Plus className="h-4 w-4" />
            New coupon
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active codes" value={stats.active.toString()} icon={Tag} />
        <StatCard
          label="Total redemptions"
          value={stats.totalRedemptions.toString()}
          icon={Ticket}
        />
        <StatCard
          label="Total discount given"
          value={`$${stats.totalDiscount.toFixed(2)}`}
          icon={Tag}
        />
      </div>

      {flash && (
        <div
          className={
            flash.kind === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-start justify-between gap-2"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start justify-between gap-2"
          }
        >
          <span>{flash.message}</span>
          <button
            type="button"
            onClick={() => setFlash(null)}
            className="opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, email, or notes…"
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Affiliate</TableHead>
              <TableHead>Locked to</TableHead>
              <TableHead className="text-right">Uses</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  {coupons.length === 0
                    ? "No coupons yet. Create one to get started."
                    : "No coupons match that search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const status = statusFor(row)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>{formatValue(row)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.affiliate_name ? (
                        <div className="flex flex-col">
                          <span className="text-foreground">{row.affiliate_name}</span>
                          {row.commission_rate_percent != null && (
                            <span className="text-xs text-muted-foreground">
                              {row.commission_rate_percent}% commission
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.customer_email ?? (
                        <span className="italic">Anyone</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.redemption_count}
                      {row.max_uses != null ? ` / ${row.max_uses}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(row.expires_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Copy code"
                          title={copiedCode === row.code ? "Copied!" : "Copy code"}
                          onClick={() => {
                            try {
                              navigator.clipboard?.writeText(row.code)
                              setCopiedCode(row.code)
                              window.setTimeout(() => setCopiedCode(null), 1500)
                            } catch {
                              // Older browsers / non-secure contexts: silently
                              // skip rather than throw on the admin UI.
                            }
                          }}
                        >
                          {copiedCode === row.code ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={row.active ? "Deactivate" : "Activate"}
                          title={row.active ? "Deactivate" : "Activate"}
                          onClick={() => handleToggleActive(row)}
                          disabled={isPending}
                        >
                          <Power
                            className={
                              row.active
                                ? "h-4 w-4 text-emerald-600"
                                : "h-4 w-4 text-muted-foreground"
                            }
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          title="Edit"
                          onClick={() => setEditingRow(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          title="Delete"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / edit dialogs are the same component — switching on
          whether `editingRow` is set determines update vs insert. */}
      <CouponFormDialog
        open={creating !== null}
        onOpenChange={(o) => {
          if (!o) setCreating(null)
        }}
        title={creating === "affiliate" ? "New affiliate coupon" : "New coupon"}
        description={
          creating === "affiliate"
            ? "Create a discount code for an affiliate or partner. Defaults to 20% off, one redemption per customer."
            : "Create a new discount code. Codes are case-insensitive and unique."
        }
        submitLabel={creating === "affiliate" ? "Create affiliate coupon" : "Create coupon"}
        initial={creating === "affiliate" ? EMPTY_AFFILIATE_FORM : EMPTY_FORM}
        showAffiliateFields={creating === "affiliate"}
        onSubmit={async (form) => {
          const res = await createCouponAction(formToInput(form))
          if (res.error) return res.error
          if (res.row) {
            upsertLocal(res.row)
            setFlash({ kind: "success", message: `${res.row.code} created.` })
            setCreating(null)
          }
          return null
        }}
      />

      <CouponFormDialog
        open={editingRow !== null}
        onOpenChange={(o) => {
          if (!o) setEditingRow(null)
        }}
        title="Edit coupon"
        description="Update terms or limits. The code itself can't be changed once it's been redeemed."
        submitLabel="Save changes"
        initial={editingRow ? rowToForm(editingRow) : undefined}
        codeLocked={!!editingRow && editingRow.redemption_count > 0}
        // Show affiliate fields when editing an existing affiliate
        // coupon. We check both the `source` tag AND whether any
        // affiliate metadata exists — handles legacy rows that were
        // created before the `source = "affiliate"` convention.
        showAffiliateFields={
          editingRow?.source === "affiliate" ||
          !!editingRow?.affiliate_name ||
          !!editingRow?.affiliate_email ||
          editingRow?.commission_rate_percent != null
        }
        onSubmit={async (form) => {
          if (!editingRow) return null
          const res = await updateCouponAction(editingRow.id, formToInput(form))
          if (res.error) return res.error
          if (res.row) {
            upsertLocal(res.row)
            setFlash({ kind: "success", message: `${res.row.code} updated.` })
            setEditingRow(null)
          }
          return null
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.redemption_count > 0 ? (
                <>
                  <span className="font-mono">{deleteTarget.code}</span> has been
                  redeemed{" "}
                  <strong>
                    {deleteTarget.redemption_count}{" "}
                    {deleteTarget.redemption_count === 1 ? "time" : "times"}
                  </strong>
                  . It will be deactivated instead of deleted so historical
                  orders keep their reference.
                </>
              ) : (
                <>
                  This will permanently delete{" "}
                  <span className="font-mono">{deleteTarget?.code}</span>. This
                  can&apos;t be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : deleteTarget && deleteTarget.redemption_count > 0 ? (
                "Deactivate"
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Convert form-state to the action's expected input shape. */
function formToInput(form: FormState) {
  const num = (s: string): number | null => {
    const t = s.trim()
    if (t === "") return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return {
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: Number(form.value),
    maxUses: num(form.maxUses),
    maxPerCustomer: num(form.maxPerCustomer),
    minOrderSubtotal: num(form.minOrderSubtotal),
    // datetime-local is naive local time. Treat it as such — JS will
    // serialize through the user's timezone offset on `new Date()`.
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    customerEmail: form.customerEmail.trim() || null,
    notes: form.notes.trim() || null,
    active: form.active,
    affiliateName: form.affiliateName.trim() || null,
    affiliateEmail: form.affiliateEmail.trim() || null,
    commissionRatePercent: num(form.commissionRatePercent),
    source: form.source,
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  )
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  initial?: FormState
  /** When true, the code field is disabled (used during edit-after-redeem). */
  codeLocked?: boolean
  /** When true, the dialog renders the affiliate / partner section. */
  showAffiliateFields?: boolean
  /** Returns an error string if submission fails, null on success. */
  onSubmit: (form: FormState) => Promise<string | null>
}

function CouponFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initial,
  codeLocked,
  showAffiliateFields,
  onSubmit,
}: FormDialogProps) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Sync form state whenever `initial` changes — this handles clicking
  // Edit on a different row. Without this effect the closure in
  // `handleOpenChange` holds a stale `initial` reference.
  useEffect(() => {
    setForm(initial ?? EMPTY_FORM)
    setError(null)
  }, [initial])

  // Reset the form whenever the dialog opens so reused state from a
  // prior open doesn't leak through. Using a layout effect would be
  // overkill — open/close is infrequent.
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(initial ?? EMPTY_FORM)
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.code.trim()) {
      setError("Code is required.")
      return
    }
    if (!form.value || Number(form.value) <= 0) {
      setError("Value must be greater than zero.")
      return
    }
    if (form.type === "percent" && Number(form.value) > 100) {
      setError("Percent values can't exceed 100.")
      return
    }
    setSubmitting(true)
    const err = await onSubmit(form)
    setSubmitting(false)
    if (err) setError(err)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
                placeholder="SUMMER25"
                disabled={codeLocked}
                className="font-mono uppercase tracking-wider"
                required
              />
              {codeLocked && (
                <p className="text-xs text-muted-foreground">
                  Code is locked because this coupon already has redemptions.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as "percent" | "fixed" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-value">
                {form.type === "percent" ? "Percent (%)" : "Amount ($)"}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                inputMode="decimal"
                step={form.type === "percent" ? "1" : "0.01"}
                min="0"
                max={form.type === "percent" ? "100" : undefined}
                value={form.value}
                onChange={(e) => {
                  const next = e.target.value
                  setForm((f) => {
                    // Mirror the affiliate-name handler: keep the code in
                    // sync (e.g. JANE20 → JANE25) as long as the admin
                    // hasn't manually edited it.
                    const codeShouldFollow =
                      showAffiliateFields &&
                      f.affiliateName.trim() !== "" &&
                      f.code === suggestAffiliateCode(f.affiliateName, f.value)
                    return {
                      ...f,
                      value: next,
                      code: codeShouldFollow
                        ? suggestAffiliateCode(f.affiliateName, next)
                        : f.code,
                    }
                  })
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-min">Min. order subtotal ($)</Label>
              <Input
                id="coupon-min"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={form.minOrderSubtotal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minOrderSubtotal: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-max-uses">Max total uses</Label>
              <Input
                id="coupon-max-uses"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="Unlimited"
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-max-per">Max per customer</Label>
              <Input
                id="coupon-max-per"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="Unlimited"
                value={form.maxPerCustomer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxPerCustomer: e.target.value }))
                }
              />
            </div>
          </div>

          {showAffiliateFields && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Affiliate / partner
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Used so you can attribute redemptions and pay commission. The
                affiliate&apos;s buyers redeem the code at checkout like any
                other discount.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-aff-name">Name</Label>
                  <Input
                    id="coupon-aff-name"
                    value={form.affiliateName}
                    onChange={(e) => {
                      const next = e.target.value
                      setForm((f) => {
                        // Auto-suggest the code when the admin hasn't typed
                        // their own yet. Once they edit the code field
                        // manually, we stop overwriting.
                        const suggested = suggestAffiliateCode(next, f.value)
                        const codeShouldFollow =
                          f.code === "" ||
                          f.code === suggestAffiliateCode(f.affiliateName, f.value)
                        return {
                          ...f,
                          affiliateName: next,
                          code: codeShouldFollow ? suggested : f.code,
                        }
                      })
                    }}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-aff-email">Contact email</Label>
                  <Input
                    id="coupon-aff-email"
                    type="email"
                    value={form.affiliateEmail}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, affiliateEmail: e.target.value }))
                    }
                    placeholder="jane@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-aff-commission">
                  Commission rate (%)
                </Label>
                <Input
                  id="coupon-aff-commission"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  max="100"
                  value={form.commissionRatePercent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      commissionRatePercent: e.target.value,
                    }))
                  }
                  placeholder="e.g. 10"
                />
                <p className="text-xs text-muted-foreground">
                  Stored for your records — commission is computed against
                  this coupon&apos;s redemptions in reports.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="coupon-email">Lock to customer email</Label>
            <Input
              id="coupon-email"
              type="email"
              placeholder="Optional — anyone can redeem if blank"
              value={form.customerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerEmail: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coupon-expires">Expires at</Label>
            <Input
              id="coupon-expires"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coupon-notes">Internal notes</Label>
            <Textarea
              id="coupon-notes"
              rows={2}
              placeholder="Why was this coupon created? (Visible to admins only.)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <div>
              <Label htmlFor="coupon-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive codes are rejected at checkout.
              </p>
            </div>
            <Switch
              id="coupon-active"
              checked={form.active}
              onCheckedChange={(c) => setForm((f) => ({ ...f, active: c }))}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
