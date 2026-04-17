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

export function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signUpAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSuccess(true)
    })
  }

  if (success) {
    return (
      <Card className="border-2">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Account created</h2>
          <p className="text-sm text-muted-foreground mb-6">
            If email confirmation is enabled, check your inbox. Then visit{" "}
            <Link href="/admin/bootstrap" className="underline">
              /admin/bootstrap
            </Link>{" "}
            to grant admin access to this account.
          </p>
          <Button onClick={() => router.push("/admin/login")} className="w-full">
            Go to Sign In
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2">
      <CardContent className="p-8">
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
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" name="full_name" type="text" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
