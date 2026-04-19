import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { RecoverCartClient } from "./recover-cart-client"
import type { AbandonedCartItemSnapshot } from "@/lib/abandoned-carts"

export const dynamic = "force-dynamic"

/**
 * Public recovery deep-link landed on by shoppers clicking the CTA in
 * their reminder email. We look the cart up by token (not email), seed
 * the client-side cart context with its items, then redirect to
 * /checkout. If the cart is already recovered we still restore it — the
 * shopper might be re-using the link to reorder.
 */
export default async function RecoverCartPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!token || token.length < 16) notFound()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("abandoned_carts")
    .select("id, email, items, recovered_at, first_name")
    .eq("token", token)
    .maybeSingle()

  if (error) {
    console.log("[v0] recover-cart lookup error:", error)
    notFound()
  }
  if (!data) notFound()

  const items = Array.isArray(data.items) ? (data.items as AbandonedCartItemSnapshot[]) : []
  if (items.length === 0) notFound()

  const firstName = typeof data.first_name === "string" ? data.first_name : null

  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-serif text-2xl text-foreground">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Restoring your cart and taking you to checkout…
        </p>
        <RecoverCartClient items={items} email={data.email ?? ""} />
      </div>
    </main>
  )
}
