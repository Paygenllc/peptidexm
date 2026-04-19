"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Mail, Trash2, Check, AlertCircle, Search, ShoppingCart } from "lucide-react"
import {
  sendAbandonedCartReminderAction,
  deleteAbandonedCartAction,
} from "@/app/admin/actions/abandoned-carts"
import type { AbandonedCartItemSnapshot } from "@/lib/abandoned-carts"

export interface AbandonedCartView {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  items: AbandonedCartItemSnapshot[]
  subtotal: number
  reminderCount: number
  lastReminderSentAt: string | null
  recoveredAt: string | null
  createdAt: string
  updatedAt: string
}

const MAX_REMINDERS = 2

export function AbandonedCartsClient({ carts }: { carts: AbandonedCartView[] }) {
  const [query, setQuery] = useState("")
  // Per-row inline status so multiple admins can work the list without
  // one success message blowing away another's.
  const [rowStatus, setRowStatus] = useState<Record<string, { kind: "ok" | "err"; msg: string }>>({})
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return carts
    return carts.filter((c) => {
      const hay = [c.email, c.firstName, c.lastName, c.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [carts, query])

  const openCarts = filtered.filter((c) => !c.recoveredAt)
  const recoveredCarts = filtered.filter((c) => c.recoveredAt)

  function setStatus(id: string, status: { kind: "ok" | "err"; msg: string }) {
    setRowStatus((prev) => ({ ...prev, [id]: status }))
    // Clear after 5s so old toasts don't pile up.
    window.setTimeout(() => {
      setRowStatus((prev) => {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 5000)
  }

  function handleSend(id: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set("id", id)
      const res = await sendAbandonedCartReminderAction(fd)
      if (res && "error" in res && res.error) {
        setStatus(id, { kind: "err", msg: res.error })
      } else if (res && "success" in res && res.success) {
        setStatus(id, {
          kind: "ok",
          msg: `Reminder ${res.ordinal}/${MAX_REMINDERS} sent`,
        })
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this abandoned cart? This cannot be undone.")) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set("id", id)
      const res = await deleteAbandonedCartAction(fd)
      if (res && "error" in res && res.error) {
        setStatus(id, { kind: "err", msg: res.error })
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by email, name, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-foreground">Open ({openCarts.length})</h2>
          <p className="text-xs text-muted-foreground">
            Auto-reminders cap at {MAX_REMINDERS}
          </p>
        </div>
        {openCarts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No open abandoned carts.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {openCarts.map((cart) => (
              <CartRow
                key={cart.id}
                cart={cart}
                status={rowStatus[cart.id]}
                onSend={() => handleSend(cart.id)}
                onDelete={() => handleDelete(cart.id)}
              />
            ))}
          </div>
        )}
      </section>

      {recoveredCarts.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-foreground">
            Recovered ({recoveredCarts.length})
          </h2>
          <div className="space-y-3">
            {recoveredCarts.map((cart) => (
              <CartRow
                key={cart.id}
                cart={cart}
                status={rowStatus[cart.id]}
                onSend={() => handleSend(cart.id)}
                onDelete={() => handleDelete(cart.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CartRow({
  cart,
  status,
  onSend,
  onDelete,
}: {
  cart: AbandonedCartView
  status?: { kind: "ok" | "err"; msg: string }
  onSend: () => void
  onDelete: () => void
}) {
  const fullName = [cart.firstName, cart.lastName].filter(Boolean).join(" ").trim()
  const totalItems = cart.items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
  const canSend = !cart.recoveredAt && cart.reminderCount < MAX_REMINDERS

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-foreground truncate">
                {fullName || cart.email}
              </p>
              {cart.recoveredAt && (
                <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 gap-1">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Recovered
                </Badge>
              )}
              {!cart.recoveredAt && cart.reminderCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Mail className="h-3 w-3" aria-hidden="true" />
                  {cart.reminderCount}/{MAX_REMINDERS} sent
                </Badge>
              )}
            </div>
            {fullName && (
              <p className="text-sm text-muted-foreground truncate">{cart.email}</p>
            )}
            {cart.phone && (
              <p className="text-sm text-muted-foreground">{cart.phone}</p>
            )}

            <ul className="text-sm text-foreground space-y-1 mt-2">
              {cart.items.slice(0, 4).map((i, idx) => (
                <li key={idx} className="flex items-baseline gap-2">
                  <ShoppingCart
                    className="h-3 w-3 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {i.name} <span className="text-muted-foreground">({i.variant})</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums ml-auto whitespace-nowrap">
                    × {i.quantity}
                  </span>
                </li>
              ))}
              {cart.items.length > 4 && (
                <li className="text-xs text-muted-foreground pl-5">
                  +{cart.items.length - 4} more
                </li>
              )}
            </ul>

            <div className="flex items-baseline gap-4 text-xs text-muted-foreground mt-2">
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  ${cart.subtotal.toFixed(2)}
                </span>{" "}
                subtotal
              </span>
              <span>{totalItems} items</span>
              <time dateTime={cart.createdAt}>
                {new Date(cart.createdAt).toLocaleString()}
              </time>
            </div>

            {status && (
              <p
                className={`text-xs flex items-center gap-1.5 mt-2 ${
                  status.kind === "ok" ? "text-emerald-700" : "text-destructive"
                }`}
                role="status"
              >
                {status.kind === "ok" ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                )}
                {status.msg}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={onSend}
              disabled={!canSend}
              className="gap-1.5"
              title={
                !canSend
                  ? cart.recoveredAt
                    ? "Already recovered"
                    : `Max ${MAX_REMINDERS} reminders reached`
                  : undefined
              }
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send reminder
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete cart"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
