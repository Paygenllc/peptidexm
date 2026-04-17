'use client'

import { useState, useTransition } from 'react'
import { promoteToAdmin } from '../actions/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export function BootstrapForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const email = String(new FormData(form).get('email') || '')
    startTransition(async () => {
      const result = await promoteToAdmin(email)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <Card className="border-2">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-medium mb-2">Admin access granted</h2>
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
          Enter the email of the account that should become the first admin. The account must
          already exist — create it at{' '}
          <Link href="/admin/signup" className="underline">
            /admin/signup
          </Link>
          .
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
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
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? 'Granting access...' : 'Grant Admin Access'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
