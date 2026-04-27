import type { Metadata } from "next"
import { getChatBusinessHours, isWithinBusinessHours } from "@/lib/chat-hours.server"
import { ChatHoursForm } from "./chat-hours-form"

export const metadata: Metadata = {
  title: "Chat hours — PeptideXM Admin",
}

export const dynamic = "force-dynamic"

export default async function ChatHoursSettingsPage() {
  const hours = await getChatBusinessHours()
  const isOnline = await isWithinBusinessHours()

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl sm:text-3xl font-medium text-foreground">
          Chat hours
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When the floating chat bubble shows visitors as &ldquo;online&rdquo; vs
          &ldquo;offline.&rdquo; Online: phone is optional and the form
          promises a fast reply. Offline: phone is required and the form
          promises a reply within 24 hours.
        </p>
      </header>

      <div
        className={`rounded-md border px-4 py-3 text-sm ${
          isOnline
            ? "border-green-500/40 bg-green-500/5 text-green-800 dark:text-green-300"
            : "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300"
        }`}
        role="status"
        aria-live="polite"
      >
        Right now the bubble is showing as{" "}
        <strong className="font-semibold">
          {isOnline ? "online" : "offline"}
        </strong>
        .
      </div>

      <ChatHoursForm initial={hours} />
    </div>
  )
}
