"use client"

import { useState, useTransition } from "react"
import { requestPasswordResetAction } from "../../actions/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordResetAction(formData)
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
        <CardContent className="p-6 sm:p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-4" aria-hidden="true" />
          <h2 className="font-serif text-xl font-medium mb-2">Check your email</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If an account exists for that email, a password reset link is on its way. The link expires in 1 hour.
          </p>
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
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
