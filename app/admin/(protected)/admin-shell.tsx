"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logoutAction } from "../actions/auth"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Mail,
  FileText,
  LogOut,
  Home,
  Menu,
} from "lucide-react"

const navSections: Array<{
  label: string
  items: Array<{ href: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }>
}> = [
  {
    label: "Overview",
    items: [{ href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true }],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
      { href: "/admin/products", icon: Package, label: "Products" },
      { href: "/admin/customers", icon: Users, label: "Customers" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/email", icon: Mail, label: "Email" },
      { href: "/admin/blog", icon: FileText, label: "Blog" },
    ],
  },
]

export function AdminShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] bg-background lg:flex">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link href="/admin" className="font-sans font-bold text-lg text-foreground">
          PeptideXM Admin
        </Link>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <SidebarContents
              email={email}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-card flex-col shrink-0 sticky top-0 h-screen">
        <SidebarContents email={email} />
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

function SidebarContents({
  email,
  onNavigate,
}: {
  email: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 sm:p-6 border-b border-border">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="font-sans font-bold text-lg sm:text-xl text-foreground"
        >
          PeptideXM Admin
        </Link>
        <p className="text-xs text-muted-foreground mt-1 truncate">{email}</p>
      </div>

      <nav className="flex-1 p-3 sm:p-4 space-y-5 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/")
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 sm:p-4 border-t border-border space-y-1 safe-pb">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Home className="w-4 h-4" />
          View Store
        </Link>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 px-3 h-10 font-normal text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}
