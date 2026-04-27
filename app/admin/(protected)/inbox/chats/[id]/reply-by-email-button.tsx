"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Mail, ChevronDown, Check, Copy, ExternalLink } from "lucide-react"

/**
 * Multi-target reply button for the chat detail page.
 *
 * Why this exists: a plain `mailto:` link only works when the OS has
 * a default mail handler registered. Most operators live in Gmail
 * web or Outlook web and never set one, so on desktop Chrome the
 * button silently did nothing. This component routes the same
 * pre-filled subject + body to whichever web mail client the
 * operator actually uses, with `mailto:` still available as a
 * fallback for native Mail.app / Thunderbird users.
 *
 * The compose URLs are documented public endpoints:
 *   - Gmail:   https://mail.google.com/mail/?view=cm&fs=1&to=&su=&body=
 *   - Outlook: https://outlook.office.com/mail/deeplink/compose?to=&subject=&body=
 *   - Yahoo:   https://compose.mail.yahoo.com/?to=&subject=&body=
 *
 * All three accept query-encoded values; the dropdown opens them in
 * a new tab so the admin shell stays put.
 */
export function ReplyByEmailButton({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) {
  const [copied, setCopied] = useState(false)

  // Pre-encode once. We need three flavors:
  //   `enc` — generic RFC-3986 encoding for query params
  //   `mailtoBody` — same content but mailto: tolerates fewer chars,
  //                  so we re-encode parens/asterisks for safety.
  const enc = encodeURIComponent
  const mailtoUrl = `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`
  const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`
  const yahooUrl = `https://compose.mail.yahoo.com/?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`

  function openInNewTab(url: string) {
    // window.open with noopener avoids exposing window.opener to the
    // mail provider page, which is a minor but free hardening win.
    window.open(url, "_blank", "noopener,noreferrer")
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(to)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Browsers without clipboard permission fall through silently;
      // the operator can still right-click the email link in the
      // header to copy it.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2">
          <Mail className="w-4 h-4" />
          Reply by email
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Compose with…
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => openInNewTab(gmailUrl)} className="gap-2">
          <ExternalLink className="w-3.5 h-3.5" />
          Gmail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openInNewTab(outlookUrl)} className="gap-2">
          <ExternalLink className="w-3.5 h-3.5" />
          Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openInNewTab(yahooUrl)} className="gap-2">
          <ExternalLink className="w-3.5 h-3.5" />
          Yahoo Mail
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          {/* Native mail handler. We use an <a> here (not window.open)
            * because mailto: links must be navigated, not popped — many
            * browsers refuse to open mailto: in a new tab. */}
          <a href={mailtoUrl} className="gap-2">
            <Mail className="w-3.5 h-3.5" />
            Default mail app
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyAddress} className="gap-2">
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy email address
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
