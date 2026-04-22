"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signUpAction } from "../../actions/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

/**
 * Auth URL set. Exposed as a prop so the same form powers both the
 * admin entry point (`/admin/signup`) and the customer entry point
 * (`/signup`) without duplicating markup. Defaults to admin paths
 * for back-compat.
 */
export interface SignupFormPaths {
  signinHref?: string
}

export function SignupForm({
  paths = { signinHref: "/admin/login" },
}: { paths?: SignupFormPaths } = {}) {
  const router = useRouter()
  const signinHref = paths.signinHref ?? "/admin/login"
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get("email") || "").trim()
    startTransition(async () => {
      const result = await signUpAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSubmittedEmail(email)
      setSuccess(true)
    })
  }

  if (success) {
    return (
      <Card className="border-2">
        <CardContent className="p-6 sm:p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Check your inbox</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground break-all">{submittedEmail}</span>. Click
            the link to verify your account. After that, you can sign in and view your orders.
          </p>
          <Button onClick={() => router.push(signinHref)} className="w-full h-11">
            Go to Sign In
          </Button>
        </CardContent>
      </Card>
    )
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
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" type="text" autoComplete="name" />
          </div>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have an account?{" "}
          <Link
            href={signinHref}
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
