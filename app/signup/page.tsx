import Link from "next/link"
import { redirect } from "next/navigation"
import { SignupForm } from "@/app/admin/(public)/signup/signup-form"
import { BackToStoreLink } from "@/components/back-to-store-link"
import { createClient } from "@/lib/supabase/server"

// Customer-friendly sign-up entry point. Thin alias for the admin
// signup form — same server action, same email verification flow,
// customer-friendly URL + cross-links.
export const metadata = {
  title: "Create Account",
  description:
    "Create a PeptideXM account to check out faster, save shipping addresses, and track every order in one place.",
}

export default async function CustomerSignupPage() {
  // Already signed in? Send them straight to the dashboard.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    redirect("/account")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <BackToStoreLink />
        </div>
        <div className="mb-6 sm:mb-8 text-center">
          <Link
            href="/"
            className="inline-block mb-6 font-serif text-2xl sm:text-3xl tracking-tight text-foreground hover:text-accent transition-colors"
          >
            Peptide<span className="text-accent">XM</span>
          </Link>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-balance">
            Create your account
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 text-pretty">
            Check out faster and keep track of every order in one place.
          </p>
        </div>
        <SignupForm paths={{ signinHref: "/signin" }} />
      </div>
    </div>
  )
}
