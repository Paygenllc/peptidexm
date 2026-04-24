"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { acceptAge, hasAgeAck } from "@/lib/consent"

/**
 * Blocking age + research-use acknowledgement on first visit.
 *
 * We gate the entire site behind this dialog because PeptideXM sells
 * research chemicals that are not for human consumption — the shopper
 * must affirmatively confirm they're 21+ and that they understand the
 * research-use-only nature of the products before they see any
 * product pages. This is a compliance hygiene measure (it doesn't
 * replace anything server-side) and the simplest defensible pattern
 * in the research-peptide industry.
 *
 * Implementation notes:
 *
 * - Uses AlertDialog rather than Dialog: AlertDialog intentionally
 *   omits a close button and swallows escape/outside-click dismissals
 *   unless an explicit Action/Cancel button is used. That's exactly
 *   the semantics we need — no way around the gate except the two
 *   buttons we render.
 *
 * - The "Exit" button sends the shopper to about:blank rather than
 *   trying to `window.close()` (which only works on windows JS
 *   opened itself in modern browsers). This is the same approach
 *   most alcohol and adult-content sites use for an under-21 click.
 *
 * - We stash the decision in a 30-day cookie so returning shoppers
 *   aren't re-prompted on every visit. The cookie is first-party
 *   and strictly functional — it's not affected by the separate
 *   cookie-consent banner that handles analytics opt-in.
 *
 * - Render is suppressed on the server and during the initial
 *   hydration pass by the `mounted` gate. This avoids flashing the
 *   dialog for users who already acknowledged (their cookie can't
 *   be read during SSR, so without the gate every shopper would
 *   see a flash of the dialog on every navigation).
 */
export function AgeGateDialog() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!hasAgeAck()) setOpen(true)
  }, [])

  if (!mounted) return null

  const handleAccept = () => {
    acceptAge()
    setOpen(false)
  }

  const handleExit = () => {
    // about:blank is the universal "leave this site" destination —
    // works in every browser, doesn't require JS origin permissions,
    // and doesn't accidentally advertise a competitor.
    if (typeof window !== "undefined") {
      window.location.href = "about:blank"
    }
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-2xl">
            Confirm you&apos;re 21 or older
          </AlertDialogTitle>
          <AlertDialogDescription className="text-pretty leading-relaxed">
            This site sells research chemicals intended for in-vitro and
            laboratory research only. Products are{" "}
            <span className="font-medium text-foreground">
              not for human consumption
            </span>{" "}
            and not for use in diagnosis, treatment, or prevention of any
            disease.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Detail block. Kept visually distinct from the description so
         * the shopper's eye lands on the list before the buttons. */}
        <div className="mt-2 rounded-md border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
          <p className="mb-2 font-medium">By continuing you confirm that:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>You are at least 21 years of age.</li>
            <li>
              You are a qualified researcher purchasing these products for
              laboratory use only.
            </li>
            <li>
              You have read and agree to our{" "}
              <Link
                href="/terms"
                className="font-medium text-foreground underline underline-offset-2 hover:text-accent"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-2 hover:text-accent"
              >
                Privacy Policy
              </Link>
              .
            </li>
          </ul>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={handleExit}>
            Exit
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleAccept}>
            I agree, enter site
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
