import { createAdminClient } from '@/lib/supabase/admin'
import { BootstrapForm } from './bootstrap-form'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'Admin Bootstrap | PeptideXM',
}

export const dynamic = 'force-dynamic'

export default async function BootstrapPage() {
  const admin = createAdminClient()
  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', true)

  const hasAdmin = (count ?? 0) > 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-medium">Admin Bootstrap</h1>
          <p className="text-muted-foreground mt-2">
            One-time setup for the initial admin account.
          </p>
        </div>

        {hasAdmin ? (
          <Card className="border-2">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="font-serif text-2xl font-medium mb-2">Admin already configured</h2>
              <p className="text-sm text-muted-foreground mb-6">
                An admin account has already been created. Sign in or ask an existing admin to grant you access.
              </p>
              <Button asChild className="w-full">
                <Link href="/admin/login">Go to Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <BootstrapForm />
        )}
      </div>
    </div>
  )
}
