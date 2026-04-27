import { NextResponse } from "next/server"
import { getChatAvailability } from "@/lib/chat-hours.server"

/**
 * Tiny public endpoint the chat bubble fetches on mount to decide
 * whether to show "We're online" or "We're back Mon–Fri 9 – 5 PM
 * New York" in its header.
 *
 * - GET only.
 * - Always responds 200 with `{ open: true }` on any internal error
 *   (see the catch below) so a Postgres hiccup never blocks the
 *   bubble from rendering — the worst outcome is an over-promise
 *   of "online" copy that still routes to the same lead form.
 * - Disables CDN caching so admin hour changes take effect on the
 *   next page load, not after a stale CDN entry expires.
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const availability = await getChatAvailability()
    return NextResponse.json(availability, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (err) {
    console.error("[v0] /api/chat/availability failed", err)
    return NextResponse.json(
      { open: true, hoursLabel: "" },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  }
}
