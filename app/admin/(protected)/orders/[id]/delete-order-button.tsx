"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { deleteOrderAction } from "@/app/admin/actions/orders"
import { Loader2, Trash2 } from "lucide-react"

/**
 * Destructive action to permanently delete an order. We keep this deliberately
 * out of the main OrderStatusForm so it can never be triggered by an errant
 * Enter keypress on the status form — and we force a literal "DELETE" typed
 * confirmation because order rows cascade to order_items and status history.
 *
 * Navigates back to the list on success so the stale detail URL doesn't 404.
 */
export function DeleteOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string
  orderNumber: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    const answer = window.prompt(
      `Permanently delete order ${orderNumber}?\n\nThis also removes its line items and status history and cannot be undone.\n\nType DELETE to confirm.`,
    )
    if (answer !== "DELETE") return

    setError(null)
    startTransition(async () => {
      const res = await deleteOrderAction(orderId)
      if (res?.error) {
        setError(res.error)
        return
      }
      router.replace("/admin/orders")
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="w-full justify-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Delete order
      </Button>
      {error && (
        <p className="text-xs text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1.5">
          {error}
        </p>
      )}
    </div>
  )
}
