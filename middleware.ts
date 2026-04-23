import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Hostname(s) that are attached to this Vercel project purely as
 * payment-provider return aliases — Squadco and PayPal record the
 * redirect URL on every order and display it in their merchant
 * dashboards, so we use a neutral alias host to keep the primary
 * storefront domain out of those dashboards.
 *
 * We derive the stealth host from NEXT_PUBLIC_PAYMENT_RETURN_ORIGIN
 * (the same env var the checkout client reads when building redirect
 * URLs) so there is exactly one knob to configure. If the env var is
 * unset, no host is treated as stealth and the middleware behaves
 * identically to before.
 */
function getStealthHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_PAYMENT_RETURN_ORIGIN?.trim()
  if (!raw) return null
  try {
    // Accept either a bare host or a full URL. `new URL` tolerates
    // both http:// and https:// inputs; we only care about the host.
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.host.toLowerCase() || null
  } catch {
    return null
  }
}

/**
 * Primary storefront origin the shopper should end up on after a
 * payment completes. We rewrite Squadco's /checkout?card_success=...
 * return URL and the post-PayPal-capture /checkout?paypal_status=...
 * redirect to this origin so the success panel renders on the real
 * store domain, not the stealth alias.
 *
 * Falls back to the incoming request's origin if the env var is
 * missing, which keeps local development working without extra setup.
 */
function getPrimaryOrigin(request: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_PRIMARY_ORIGIN?.trim()
  if (raw) {
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
      return url.origin
    } catch {
      // fall through
    }
  }
  return request.nextUrl.origin
}

/**
 * Paths the stealth host is allowed to serve itself. Anything outside
 * this allowlist is either redirected to the primary origin (for
 * /checkout return URLs) or 404'd (everything else).
 *
 * `/api/paypal/return` MUST run on whatever host PayPal has on file,
 * because that's the URL PayPal redirects the shopper's browser to
 * after approval — the handler there calls the capture API and then
 * issues its own redirect to /checkout. We let it execute on the
 * stealth host so the capture succeeds, then its internal redirect
 * bounces the shopper to the primary origin via this same middleware.
 */
const STEALTH_ALLOWLIST = new Set<string>([
  '/api/paypal/return',
  // Squadco POSTs charge-confirmation webhooks to whatever URL is
  // configured in their merchant dashboard. That URL tends to match
  // the redirect URL (same "keep the primary storefront out of the
  // dashboard" motivation), so we allow the webhook to execute on
  // the stealth host too. The handler doesn't issue any redirects,
  // it just updates the DB and 200s, so there's no interaction with
  // the /checkout redirect rule above.
  '/api/squadco/webhook',
])

export async function middleware(request: NextRequest) {
  const stealthHost = getStealthHost()
  const requestHost = request.headers.get('host')?.toLowerCase() ?? ''

  if (stealthHost && requestHost === stealthHost) {
    const { pathname, search } = request.nextUrl
    const primaryOrigin = getPrimaryOrigin(request)

    // 1. /checkout is the landing path for both the Squadco return
    //    (card_success=true) and the post-PayPal-capture redirect
    //    (paypal_status=...). Bounce the shopper to the primary
    //    storefront with the full query string preserved so the
    //    client-side success panel can render normally.
    if (pathname === '/checkout' || pathname.startsWith('/checkout/')) {
      const destination = new URL(`${pathname}${search}`, primaryOrigin)
      return NextResponse.redirect(destination, 302)
    }

    // 2. Server-side payment webhooks (currently just PayPal's return
    //    handler) are allowed to execute on the stealth host. They
    //    issue their own redirects, which fall back through rule #1
    //    on the next request.
    for (const allowed of STEALTH_ALLOWLIST) {
      if (pathname === allowed || pathname.startsWith(`${allowed}/`)) {
        return NextResponse.next()
      }
    }

    // 3. Everything else — the homepage, products, admin, static
    //    assets, unrelated API routes — returns 404. The stealth
    //    domain exists purely as a payment-return alias, so visiting
    //    it directly looks like a dead host, which is the whole
    //    point of keeping it out of the merchant dashboards.
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        // Make sure the 404 is not cacheable — we don't want a
        // shared edge cache holding a stale 404 for a path we
        // might legitimately want to serve later.
        'Cache-Control': 'no-store',
      },
    })
  }

  // Non-stealth hosts fall through to the usual Supabase session
  // refresh — unchanged from before.
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     *
     * Note: the stealth-host check runs on every matched path, so
     * those static asset exclusions ALSO mean shop.kavidattic.com
     * can still 200 on asset URLs. That's a non-issue — nothing on
     * the site links to assets via the stealth host, so nobody will
     * ever request one.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
