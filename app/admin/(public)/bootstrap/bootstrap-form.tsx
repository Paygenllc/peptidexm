"use client"

import { useState, useTransition } from "react"
import { bootstrapAdminAction } from "../../actions/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"

export function BootstrapForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await bootstrapAdminAction(formData)
      if (result?.error) setError(result.error)
      else setSuccess(true)
    })
  }

  if (success) {
    return (
      <Card className="border-2">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Admin access granted</h2>
          <p className="text-sm text-muted-foreground mb-6">
            That account is now an admin. Sign in to access the admin portal.
          </p>
          <Button asChild className="w-full">
            <Link href="/admin/login">Go to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2">
      <CardContent className="p-8">
        <p className="text-sm text-muted-foreground mb-6">
          Enter the email of the account that should become the first admin. The account must already exist — create
          it at{" "}
          <Link href="/admin/signup" className="underline">
            /admin/signup
          </Link>
          . You&apos;ll also need the <code className="bg-muted px-1 rounded">ADMIN_BOOTSTRAP_SECRET</code> value set
          on the server.
        </p>
        <form action={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Admin Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret">Bootstrap Secret</Label>
            <Input id="secret" name="secret" type="password" required />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant Admin Access"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
