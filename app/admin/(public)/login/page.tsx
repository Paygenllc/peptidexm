import { LoginForm } from './login-form'
import { Suspense } from 'react'

export const metadata = {
  title: 'Admin Login | PeptideXM',
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-medium">Admin Portal</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage orders and products</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
