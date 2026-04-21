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
 * PayPal "PP" monogram — the two overlapping P's on a white tile, framed
 * with PayPal's signature blue (#003087 primary, #009CDE secondary).
 * Recreated from the public brand for third-party method identification,
 * same fair-use posture as the other marks above.
 */
export function PaypalLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="PayPal"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="40" height="40" rx="9" fill="#FFFFFF" stroke="#E5E7EB" />
      {/* Back "P" — lighter PayPal blue, offset up and left */}
      <path
        d="M13.6 10.5h7.1c3.1 0 5.3 1.7 5.3 4.6 0 3.6-2.9 5.7-6.7 5.7h-2.7l-.9 4.7h-3.8l1.7-15z"
        fill="#009CDE"
      />
      {/* Front "P" — primary PayPal blue, nudged down and right */}
      <path
        d="M16.7 14.2h6.7c2.9 0 5 1.6 5 4.3 0 3.4-2.7 5.4-6.2 5.4h-2.6l-1 5.5h-3.6l1.7-15.2z"
        fill="#003087"
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

/**
 * Card brand marks. Each is a simplified inline SVG that mirrors the public
 * brand silhouette closely enough to be instantly recognizable on checkout
 * while staying small and dependency-free. The viewBox on all four is the
 * same aspect ratio (38×24) so they align perfectly in a row.
 */
const CARD_VIEW_BOX = "0 0 38 24"

export function VisaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={CARD_VIEW_BOX}
      role="img"
      aria-label="Visa"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="38" height="24" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
      <text
        x="19"
        y="16.5"
        textAnchor="middle"
        fontFamily="Verdana, Geneva, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="9"
        fill="#1A1F71"
        letterSpacing="0.5"
      >
        VISA
      </text>
    </svg>
  )
}

export function MastercardLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={CARD_VIEW_BOX}
      role="img"
      aria-label="Mastercard"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="38" height="24" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
      {/* Two interlocking circles — Mastercard's signature mark */}
      <circle cx="15.5" cy="12" r="6" fill="#EB001B" />
      <circle cx="22.5" cy="12" r="6" fill="#F79E1B" />
      <path
        d="M19 7.2a6 6 0 0 0 0 9.6 6 6 0 0 0 0-9.6z"
        fill="#FF5F00"
      />
    </svg>
  )
}

export function AmexLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={CARD_VIEW_BOX}
      role="img"
      aria-label="American Express"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="38" height="24" rx="3" fill="#2E77BC" />
      <text
        x="19"
        y="10.5"
        textAnchor="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="4"
        fill="#FFFFFF"
        letterSpacing="0.3"
      >
        AMERICAN
      </text>
      <text
        x="19"
        y="16"
        textAnchor="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="4"
        fill="#FFFFFF"
        letterSpacing="0.3"
      >
        EXPRESS
      </text>
    </svg>
  )
}

export function DiscoverLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={CARD_VIEW_BOX}
      role="img"
      aria-label="Discover"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="38" height="24" rx="3" fill="#FFFFFF" stroke="#E5E7EB" />
      {/* Discover signature "orange ball" dot in the bottom-right */}
      <circle cx="29" cy="14" r="5" fill="#FF6B00" />
      <text
        x="3"
        y="16"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="7"
        fill="#1A1A1A"
        letterSpacing="-0.2"
      >
        DISC
      </text>
    </svg>
  )
}

/**
 * Convenience row of all four accepted card brand marks. Used on the
 * checkout payment selector so customers can instantly see we'd accept
 * their card — even when card processing itself is temporarily disabled.
 */
export function CardBrandRow({ className }: { className?: string }) {
  const cls = "h-5 w-auto"
  return (
    <div className={className ?? "flex items-center gap-1.5"}>
      <VisaLogo className={cls} />
      <MastercardLogo className={cls} />
      <AmexLogo className={cls} />
      <DiscoverLogo className={cls} />
    </div>
  )
}
