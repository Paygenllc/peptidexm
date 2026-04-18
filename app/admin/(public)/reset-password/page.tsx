import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ResetPasswordForm } from "./reset-password-form"

export const metadata = {
  title: "Set New Password",
  description: "Choose a new password for your PeptideXM account.",
}

export default async function ResetPasswordPage() {
  // Must be in a valid recovery session (set up by /auth/confirm).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/admin/forgot-password?expired=1")
  }

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
