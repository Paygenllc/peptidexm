import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error_description?: string }>
}) {
  const params = await searchParams
  const message = params.message || params.error_description || "Your authentication link is invalid or has expired."

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Authentication error</CardTitle>
          <CardDescription>We couldn&apos;t verify your email link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Email confirmation links expire after a short time and can only be used once. Please request a new one by
            signing up again or logging in.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/admin/login">Back to login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/signup">Sign up again</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
