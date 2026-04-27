"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, Send, PenSquare, MessageSquare } from "lucide-react"

export function InboxTabs({
  unreadCount,
  newChatsCount = 0,
}: {
  unreadCount: number
  /**
   * Count of `chat_messages` rows still in `status = 'new'`. Drives
   * the badge on the Chats tab so the operator sees lead-form
   * submissions waiting for a reply at a glance.
   */
  newChatsCount?: number
}) {
  const pathname = usePathname() ?? ""

  const tabs = [
    { href: "/admin/inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
    {
      href: "/admin/inbox/chats",
      label: "Chats",
      icon: MessageSquare,
      badge: newChatsCount,
    },
    { href: "/admin/inbox/outbox", label: "Outbox", icon: Send, badge: 0 },
    { href: "/admin/inbox/compose", label: "Compose", icon: PenSquare, badge: 0 },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon
        // Inbox tab matches the exact path OR a detail page at /admin/inbox/[uuid]
        // (not /outbox, /compose, or /chats). That keeps the tab highlighted when
        // you click into a specific message from the inbox list.
        const isMailDetail =
          tab.href === "/admin/inbox" &&
          pathname.startsWith("/admin/inbox/") &&
          !pathname.startsWith("/admin/inbox/outbox") &&
          !pathname.startsWith("/admin/inbox/compose") &&
          !pathname.startsWith("/admin/inbox/chats")
        // Chats tab matches the list AND any /admin/inbox/chats/[id] detail.
        const isChatDetail =
          tab.href === "/admin/inbox/chats" &&
          pathname.startsWith("/admin/inbox/chats/")
        const active = pathname === tab.href || isMailDetail || isChatDetail
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            {tab.badge > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold h-5 min-w-5 px-1.5 tabular-nums">
                {tab.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
