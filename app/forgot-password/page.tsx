import Link from "next/link"
import { ForgotPasswordForm } from "@/app/admin/(public)/forgot-password/forgot-password-form"
import { BackToStoreLink } from "@/components/back-to-store-link"

// Customer-friendly forgot-password entry. The existing form is
// already generic (no admin-specific copy) so we don't need any
// props — just host it at a nicer URL and pair it with a "Back to
// sign in" link that points at the customer route.
export const metadata = {
  title: "Forgot Password",
  description: "Reset the password on your PeptideXM account. We'll email you a secure reset link.",
}

export default function CustomerForgotPasswordPage() {
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
            Forgot your password?
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 text-pretty">
            Enter the email you use at PeptideXM and we&apos;ll send a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Remembered it?{" "}
          <Link
            href="/signin"
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
