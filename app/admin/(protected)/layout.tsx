import type React from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "../actions/auth"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Package, ShoppingCart, LogOut, Home } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin/login")
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin, email, full_name").eq("id", user.id).single()

  if (!profile?.is_admin) {
    redirect("/admin/login?error=not_admin")
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/admin" className="font-sans font-bold text-xl text-foreground">
            PeptideXM Admin
          </Link>
          <p className="text-xs text-muted-foreground mt-1 truncate">{profile.email}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink href="/admin" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
          <NavLink href="/admin/orders" icon={<ShoppingCart className="w-4 h-4" />} label="Orders" />
          <NavLink href="/admin/products" icon={<Package className="w-4 h-4" />} label="Products" />
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            View Store
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
