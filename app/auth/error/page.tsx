import Link from "next/link"
import { AlertTriangle, ArrowRight, Mail, MonitorSmartphone } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type ErrorVariant = "expired" | "access_denied" | "invalid" | "generic"

function classify(code: string | undefined, message: string): ErrorVariant {
  const c = (code || "").toLowerCase()
  const m = message.toLowerCase()
  if (c === "otp_expired" || m.includes("expired")) return "expired"
  if (c === "access_denied") return "access_denied"
  if (m.includes("invalid") || m.includes("already")) return "invalid"
  return "generic"
}

const COPY: Record<
  ErrorVariant,
  { title: string; summary: string; primaryCta: { label: string; href: string } }
> = {
  expired: {
    title: "That link has expired",
    summary:
      "Password reset and email confirmation links are single-use and only valid for one hour. Request a fresh one below.",
    primaryCta: { label: "Request a new reset link", href: "/admin/forgot-password" },
  },
  access_denied: {
    title: "Link already used or rejected",
    summary:
      "This link was either already used or opened in a different browser than the one that requested it. Request a new link and open it from the same browser.",
    primaryCta: { label: "Request a new link", href: "/admin/forgot-password" },
  },
  invalid: {
    title: "We couldn\u2019t verify that link",
    summary:
      "The link is no longer valid. This usually means it was already used once or the token didn\u2019t match. Request a new one to try again.",
    primaryCta: { label: "Request a new link", href: "/admin/forgot-password" },
  },
  generic: {
    title: "Authentication error",
    summary:
      "We couldn\u2019t verify your email link. Request a new one and try again. If the problem keeps happening, email peptidexm@gmail.com.",
    primaryCta: { label: "Request a new link", href: "/admin/forgot-password" },
  },
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string
    error_description?: string
    code?: string
    error_code?: string
  }>
}) {
  const params = await searchParams
  const rawMessage = params.message || params.error_description || ""
  const code = params.code || params.error_code || ""
  const variant = classify(code, rawMessage)
  const { title, summary, primaryCta } = COPY[variant]

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-10">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-serif text-2xl text-balance">{title}</CardTitle>
              <CardDescription className="mt-1 text-pretty">{summary}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {rawMessage ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-mono">{rawMessage}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Button asChild size="lg" className="w-full gap-2">
              <Link href={primaryCta.href}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/login">Back to login</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/signup">Create account</Link>
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Why this usually happens
            </p>
            <ul className="space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="leading-relaxed">
                  <span className="font-medium">Your email provider pre-scanned the link.</span> Outlook, Gmail, and
                  corporate security tools often visit links to check for phishing, which consumes the one-time token
                  before you click.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <MonitorSmartphone
                  className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="leading-relaxed">
                  <span className="font-medium">Opened in a different browser.</span> Request a new link and open it
                  from the same browser you used to request it.
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
