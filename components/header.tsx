"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, ShoppingCart, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useCart } from "@/context/cart-context"
import { CartSidebar } from "@/components/cart-sidebar"

const navigation = [
  { name: "Products", href: "#products" },
  { name: "About", href: "#about" },
  { name: "Science", href: "#science" },
  { name: "FAQ", href: "#faq" },
  { name: "Contact", href: "#contact" },
]

export function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { itemCount } = useCart()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4 lg:px-8"
        aria-label="Primary"
      >
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5" aria-label="PeptideXM home">
            <span className="font-serif text-xl sm:text-2xl tracking-tight text-foreground">
              Peptide<span className="text-accent">XM</span>
            </span>
          </Link>
        </div>

        {/* Mobile actions */}
        <div className="flex lg:hidden items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCartOpen(true)}
            className="relative h-11 w-11"
            aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-medium leading-none">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Button>
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="px-6 pt-6 pb-4 border-b border-border">
                  <span className="font-serif text-2xl tracking-tight text-foreground">
                    Peptide<span className="text-accent">XM</span>
                  </span>
                </div>
                <nav className="flex-1 flex flex-col gap-1 p-4">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="text-lg font-medium text-foreground hover:bg-secondary rounded-lg px-4 py-3 transition-colors"
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>
                <div className="p-4 border-t border-border space-y-3 safe-pb">
                  <Button className="w-full h-12" asChild onClick={() => setIsMenuOpen(false)}>
                    <Link href="#products">Shop Now</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 gap-2"
                    asChild
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Link href="/admin/login">
                      <User className="h-4 w-4" />
                      Account
                    </Link>
                  </Button>
                </div>
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

        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-2">
          <Button variant="ghost" size="icon" asChild aria-label="Account">
            <Link href="/admin/login">
              <User className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-medium leading-none">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Button>
          <Button asChild>
            <Link href="#products">Shop Now</Link>
          </Button>
        </div>
      </nav>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  )
}
