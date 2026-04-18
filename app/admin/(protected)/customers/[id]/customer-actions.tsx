"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, ShieldOff, Ban, CheckCircle2, MailX, Mail, Trash2 } from "lucide-react"
import {
  toggleAdminAction,
  toggleBanAction,
  toggleNewsletterAction,
  deleteUserAction,
} from "@/app/admin/actions/customers"
import { useRouter } from "next/navigation"

export function CustomerActions({
  userId,
  isAdmin,
  isBanned,
  isSubscribed,
}: {
  userId: string
  isAdmin: boolean
  isBanned: boolean
  isSubscribed: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [adminPending, startAdmin] = useTransition()
  const [banPending, startBan] = useTransition()
  const [newsPending, startNews] = useTransition()
  const [delPending, startDel] = useTransition()

  async function run(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, fd: FormData) {
    setError(null)
    const res = await action(fd)
    if (res?.error) setError(res.error)
  }

  function handleAdminToggle() {
    const fd = new FormData()
    fd.set("userId", userId)
    fd.set("makeAdmin", String(!isAdmin))
    startAdmin(() => run(toggleAdminAction, fd))
  }

  function handleBanToggle() {
    const fd = new FormData()
    fd.set("userId", userId)
    fd.set("ban", String(!isBanned))
    startBan(() => run(toggleBanAction, fd))
  }

  function handleNewsletterToggle() {
    const fd = new FormData()
    fd.set("userId", userId)
    fd.set("subscribe", String(!isSubscribed))
    startNews(() => run(toggleNewsletterAction, fd))
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this user? Their orders will stay on file but be orphaned. This cannot be undone.")) return
    setError(null)
    const fd = new FormData()
    fd.set("userId", userId)
    startDel(async () => {
      const res = await deleteUserAction(fd)
      if (res?.error) setError(res.error)
      else router.push("/admin/customers")
    })
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={handleAdminToggle}
        disabled={adminPending}
      >
        {adminPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isAdmin ? (
          <ShieldOff className="w-4 h-4" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
        {isAdmin ? "Remove admin role" : "Promote to admin"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={handleNewsletterToggle}
        disabled={newsPending}
      >
        {newsPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          <MailX className="w-4 h-4" />
        ) : (
          <Mail className="w-4 h-4" />
        )}
        {isSubscribed ? "Unsubscribe from email" : "Subscribe to email"}
      </Button>

      <Button
        variant={isBanned ? "outline" : "destructive"}
        size="sm"
        className="w-full justify-start gap-2"
        onClick={handleBanToggle}
        disabled={banPending}
      >
        {banPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isBanned ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Ban className="w-4 h-4" />
        )}
        {isBanned ? "Lift ban" : "Ban customer"}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={handleDelete}
        disabled={delPending}
      >
        {delPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Delete user account
      </Button>

      {error && (
        <p className="text-xs text-destructive mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-2.5 py-1.5">
          {error}
        </p>
      )}
    </div>
  )
}
