import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

/**
 * Shared layout for policy / info pages linked from the footer. Keeps
 * typography consistent with the blog read surface (`prose`) while giving
 * each page its own title + lead paragraph above the fold. Pages pass the
 * copy as children; the outer frame (header/footer, max width, spacing)
 * lives here so we don't repeat it on every page.
 */
export function LegalPage({
  title,
  lead,
  updated,
  children,
}: {
  title: string
  lead?: string
  updated?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-20 lg:px-8">
        <header className="mb-10 sm:mb-14">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight text-balance">
            {title}
          </h1>
          {lead && (
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground text-pretty leading-relaxed">
              {lead}
            </p>
          )}
          {updated && (
            <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
              Last updated {updated}
            </p>
          )}
        </header>

        <div
          className="prose prose-neutral max-w-none
            prose-headings:font-serif prose-headings:tracking-tight
            prose-h2:text-2xl prose-h2:font-medium prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-xl prose-h3:font-medium prose-h3:mt-8
            prose-p:leading-relaxed prose-p:text-foreground/85
            prose-li:text-foreground/85 prose-li:leading-relaxed
            prose-a:text-accent prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-blockquote:border-l-accent prose-blockquote:text-foreground/75
            prose-hr:border-border"
        >
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
