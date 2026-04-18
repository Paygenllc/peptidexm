import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function BackToStoreLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to store
    </Link>
  )
}
