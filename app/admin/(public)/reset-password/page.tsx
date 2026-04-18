import Link from "next/link"
import { ResetPasswordForm } from "./reset-password-form"
import { BackToStoreLink } from "@/components/back-to-store-link"

export const metadata = {
  title: "Set New Password",
  description: "Choose a new password for your PeptideXM account.",
}

// NOTE: no server-side session check here on purpose. The recovery session is
// established in the browser by the form (from either a hash fragment or a
// token_hash query param), so gating server-side would redirect users away
// before the browser ever gets a chance to verify.
export default function ResetPasswordPage() {
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
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-balance">Set a new password</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 text-pretty">
            Choose something at least 8 characters long.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  )
}
