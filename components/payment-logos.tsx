/**
 * Brand marks for the payment methods we accept.
 *
 * Rendered as inline SVG so they scale cleanly, stay crisp on retina, and
 * don't trigger an extra network request. Brand colors are deliberately
 * locked here (not tokenized) — Zelle purple and Tether green are the
 * actual corporate marks and shouldn't theme-shift with our palette.
 *
 * Each component accepts standard SVG props so callers can tweak size via
 * `className` / `width` / `height` without reaching into the internals.
 */
import type { SVGProps } from "react"

/**
 * Zelle wordmark-style "Z" inside a rounded square tile. Recreated from
 * the public brand (not copied bit-for-bit) so we stay inside fair-use
 * for third-party payment method identification.
 */
export function ZelleLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Zelle"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="40" height="40" rx="9" fill="#6D1ED4" />
      <path
        d="M20 6.5v3.2h-5.9l9.7 13.6H14v3.2h16v-3.2h-6.2l-9.7-13.6h9v-3.2z"
        fill="#FFFFFF"
        transform="translate(-2 0)"
      />
      <path
        d="M18.6 4.5h2.8v5h-2.8zM18.6 30.5h2.8v5h-2.8z"
        fill="#FFFFFF"
      />
    </svg>
  )
}

/**
 * Tether (USDT) logo — the hexagon-T mark used on their site and in the
 * NOWPayments checkout. We pair it with a small "TRC-20" badge in the
 * parent component so customers know which network we accept.
 */
export function TetherLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Tether USDT"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="20" cy="20" r="20" fill="#26A17B" />
      <path
        d="M22.4 21.2v-2.5h5.7v-3.8H11.9v3.8h5.7v2.5c-4.6.2-8 1.1-8 2.1s3.4 1.9 8 2.1V34h4.8v-8.6c4.6-.2 8-1.1 8-2.1s-3.4-1.9-8-2.1zm0 3.5v0c-.1 0-.7 0-2.1.1-1.1 0-1.9 0-2.1-.1v0c-3.9-.2-6.9-.9-6.9-1.7s2.9-1.5 6.9-1.7v2.8c.3 0 1.2.1 2.1.1 1.3 0 2-.1 2.1-.1v-2.8c3.9.2 6.9.9 6.9 1.7s-2.9 1.5-6.9 1.7z"
        fill="#FFFFFF"
      />
    </svg>
  )
}
