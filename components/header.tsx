"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Menu, Search, ShoppingCart, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useCart } from "@/context/cart-context"
import { CartSidebar } from "@/components/cart-sidebar"
import { HeaderSearch, type HeaderSearchHandle } from "@/components/header-search"
import { AnnouncementBar } from "@/components/announcement-bar"

type NavItem = { name: string; href: string; id?: string }

const navigation: NavItem[] = [
  { name: "Products", href: "/#products", id: "products" },
  { name: "About", href: "/#about", id: "about" },
  { name: "Science", href: "/#science", id: "science" },
  { name: "Journal", href: "/blog" }, // Route link — not a scroll-spy target
  { name: "FAQ", href: "/#faq", id: "faq" },
  { name: "Contact", href: "/#contact", id: "contact" },
]

export function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("")
  const { itemCount } = useCart()
  const desktopSearchRef = useRef<HeaderSearchHandle>(null)

  // Scroll-state: crisp border + tighter background when scrolled past the hero edge.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Scroll-spy: highlight the nav item whose section is currently centered in the viewport.
  useEffect(() => {
    const ids = navigation.map((n) => n.id).filter((id): id is string => Boolean(id))
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that's intersecting and closest to the top.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      {
        // Account for header height (~64px) at top; count a section "active" once
        // it has passed the top and before its bottom has passed roughly mid-screen.
        rootMargin: "-80px 0px -55% 0px",
        threshold: 0,
      },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  // Cmd/Ctrl + K opens search. On desktop we focus the in-header input;
  // on mobile we open the full-width search sheet.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMetaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      if (!isMetaK) return

      // Respect native text fields — only intercept when not typing into another input,
      // unless the shortcut originates from the search itself (no-op then).
      const target = e.target as HTMLElement | null
      const isEditing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable
      if (isEditing) return

      e.preventDefault()
      if (window.matchMedia("(min-width: 1024px)").matches) {
        desktopSearchRef.current?.focus()
      } else {
        setIsSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow] duration-200 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          : "bg-background/70 backdrop-blur-sm border-b border-transparent"
      }`}
    >
      <AnnouncementBar />
      <nav
        className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 py-3 lg:px-8"
        aria-label="Primary"
      >
        {/* Logo */}
        <div className="flex lg:flex-none">
          <Link href="/" className="-m-1.5 p-1.5" aria-label="PeptideXM home">
            <span className="font-serif text-xl sm:text-2xl tracking-tight text-foreground">
              Peptide<span className="text-accent">XM</span>
            </span>
          </Link>
        </div>

        {/* Mobile actions */}
        <div className="flex lg:hidden items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(true)}
            className="h-11 w-11"
            aria-label="Search products"
          >
            <Search className="h-5 w-5" />
          </Button>
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
                    <Link href="/#products">Shop Now</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 gap-2"
                    asChild
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Link href="/account">
                      <User className="h-4 w-4" />
                      Account
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop navigation — centered between logo and actions */}
        <div className="hidden lg:flex lg:flex-1 lg:justify-center lg:gap-x-1">
          {navigation.map((item) => {
            const isActive = item.id ? activeSection === item.id : false
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.name}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-accent transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            )
          })}
        </div>

        {/* Desktop actions */}
        <div className="hidden lg:flex lg:items-center lg:gap-1">
          <HeaderSearch
            ref={desktopSearchRef}
            showShortcutHint
            className="w-60 xl:w-72"
          />
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <Button variant="ghost" size="icon" asChild aria-label="Account" className="h-9 w-9">
            <Link href="/account">
              <User className="h-[18px] w-[18px]" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-medium leading-none">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Button>
        </div>
      </nav>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="top" className="p-0 border-b border-border">
          <SheetTitle className="sr-only">Search products</SheetTitle>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
            <HeaderSearch autoFocus onSelectResult={() => setIsSearchOpen(false)} />
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Search by name, category, or strength. Results jump straight to the product.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
