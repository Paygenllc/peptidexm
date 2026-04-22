import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { LoginForm } from "@/app/admin/(public)/login/login-form"
import { BackToStoreLink } from "@/components/back-to-store-link"
import { createClient } from "@/lib/supabase/server"

// Customer-friendly sign-in entry point. This is a thin alias that
// reuses the same `<LoginForm>` used by `/admin/login` but with
// customer-friendly cross-links (`/signup`, `/forgot-password`) so
// regular shoppers never see the word "admin" in their URL bar.
// The backing `signInAction` in `app/admin/actions/auth.ts` routes
// admins to `/admin` and customers to `/account` after login, so
// one URL works for everyone.
export const metadata = {
  title: "Sign In",
  description:
    "Sign in to your PeptideXM account to track orders, manage your profile, and reorder favorites.",
}

export default async function CustomerSigninPage() {
  // If the visitor is already signed in, skip the form entirely and
  // drop them on their account. Avoids the "re-auth after refresh"
  // footgun and makes the page safe to link from headers / emails.
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
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-balance">Welcome back</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 text-pretty">
            Sign in to track orders and manage your account.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm
            paths={{ signupHref: "/signup", forgotPasswordHref: "/forgot-password" }}
          />
        </Suspense>
      </div>
    </div>
  )
}
