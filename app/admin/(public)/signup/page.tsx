import { SignupForm } from './signup-form'

export const metadata = {
  title: 'Admin Signup | PeptideXM',
}

export default function AdminSignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-medium">Create Admin Account</h1>
          <p className="text-muted-foreground mt-2">
            Create an account, then promote it to admin from the bootstrap page.
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
