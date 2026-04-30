"use client"

import { useState, type FormEvent } from "react"
import { Tag, X, Check } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function DiscountPopup() {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState("")

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    // Hook into a real subscribe action here when available.
    setSubmitted(true)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Reset after the close animation so users don't see the form flicker back.
      setTimeout(() => {
        setSubmitted(false)
        setEmail("")
      }, 200)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Get 10% off — subscribe to our newsletter"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 sm:px-5 sm:py-3.5 text-sm font-semibold tracking-wide text-accent-foreground shadow-lg shadow-accent/30 ring-1 ring-accent/40 transition-transform duration-200 hover:scale-[1.03] hover:shadow-xl hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background safe-pb"
      >
        <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>GET 10% OFF</span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md p-0 gap-0 overflow-hidden border-border"
        >
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Accent header band */}
          <div className="bg-accent text-accent-foreground px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1 text-xs font-medium uppercase tracking-wider">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              Limited offer
            </div>
            <DialogTitle className="mt-3 font-serif text-3xl sm:text-4xl tracking-tight text-balance">
              Get 10% off your first order
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm sm:text-base text-accent-foreground/80 leading-relaxed">
              Join the PeptideXM list for a one-time discount code, plus updates on new
              products and research.
            </DialogDescription>
          </div>

          {/* Body */}
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Check className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-4 font-medium text-foreground">You&apos;re on the list</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Check your inbox for your 10% off code. Be sure to look in spam if you
                  don&apos;t see it within a few minutes.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-5"
                  onClick={() => handleOpenChange(false)}
                >
                  Continue shopping
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label htmlFor="discount-email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="discount-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  className="h-11"
                />
                <Button type="submit" className="h-11 w-full">
                  Send my 10% off code
                </Button>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  No spam, unsubscribe anytime. By subscribing you agree to our terms.
                </p>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
