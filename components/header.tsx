"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, ShoppingCart, X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const navigation = [
  { name: "Products", href: "#products" },
  { name: "About", href: "#about" },
  { name: "Science", href: "#science" },
  { name: "FAQ", href: "#faq" },
  { name: "Contact", href: "#contact" },
]

export function Header() {
  const [cartCount] = useState(0)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="font-serif text-2xl tracking-tight text-foreground">
              Peptide<span className="text-accent">XM</span>
            </span>
          </Link>
        </div>

        {/* Mobile menu */}
        <div className="flex lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm">
              <div className="flex flex-col gap-6 pt-6">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-lg font-medium text-foreground hover:text-accent transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
                <Button className="mt-4">Shop Now</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:gap-x-10">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-4">
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
            <span className="sr-only">Account</span>
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                {cartCount}
              </span>
            )}
            <span className="sr-only">Cart</span>
          </Button>
          <Button>Shop Now</Button>
        </div>
      </nav>
    </header>
  )
}
