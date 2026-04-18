"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { signInAction } from "../../actions/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"

export function LoginForm() {
  const searchParams = useSearchParams()
  const initialError =
    searchParams.get("error") === "auth_required"
      ? "Please sign in to continue."
      : searchParams.get("error") === "not_admin"
        ? "This account does not have admin access."
        : null

  const [error, setError] = useState<string | null>(initialError)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signInAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Card className="border-2">
      <CardContent className="p-6 sm:p-8">
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/admin/forgot-password"
                className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                tabIndex={-1}
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          New to PeptideXM?{" "}
          <Link href="/admin/signup" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
