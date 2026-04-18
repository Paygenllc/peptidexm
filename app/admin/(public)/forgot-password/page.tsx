import Link from "next/link"
import { ForgotPasswordForm } from "./forgot-password-form"

export const metadata = {
  title: "Reset Password",
  description: "Request a password reset link for your PeptideXM account.",
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <Link
            href="/"
            className="inline-block mb-6 font-serif text-2xl sm:text-3xl tracking-tight text-foreground hover:text-accent transition-colors"
          >
            Peptide<span className="text-accent">XM</span>
          </Link>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-balance">Reset your password</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 text-pretty">
            Enter the email on your account and we&apos;ll send a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Remembered it?{" "}
          <Link
            href="/admin/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
