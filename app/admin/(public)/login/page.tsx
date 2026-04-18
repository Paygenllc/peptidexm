import Link from "next/link"
import { Suspense } from "react"
import { LoginForm } from "./login-form"
import { BackToStoreLink } from "@/components/back-to-store-link"

export const metadata = {
  title: "Sign In",
  description: "Sign in to your PeptideXM account to view your orders and manage your profile.",
}

export default function LoginPage() {
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
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
