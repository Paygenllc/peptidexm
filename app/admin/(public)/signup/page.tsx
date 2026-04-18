import Link from "next/link"
import { SignupForm } from "./signup-form"

export const metadata = {
  title: "Create Account",
  description: "Create a PeptideXM account to check out faster, save addresses, and track your orders.",
}

export default function SignupPage() {
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
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-balance">Create your account</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 text-pretty">
            Check out faster and keep track of every order in one place.
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
