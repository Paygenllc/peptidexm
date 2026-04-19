type VialMockupProps = {
  /** Unique id used to scope SVG gradient ids — required when two vials share a page. */
  id: string
  /** Optional Tailwind/utility classes for the <svg>. */
  className?: string
  /** Decorative, so hidden from AT by default. */
  ariaLabel?: string
}

/**
 * Decorative laboratory vial, rendered as inline SVG so it can inherit the
 * page's `currentColor` for accents and still honor prefers-reduced-motion
 * (the liquid animation is driven by a keyframe in globals.css).
 *
 * All gradient ids are namespaced by the `id` prop because rendering two
 * vials on the same page would otherwise collide and the second one would
 * inherit the first's paint.
 */
export function VialMockup({ id, className, ariaLabel }: VialMockupProps) {
  const glassId = `${id}-glass`
  const liquidId = `${id}-liquid`
  const shineId = `${id}-shine`
  const capId = `${id}-cap`

  return (
    <svg
      viewBox="0 0 120 320"
      xmlns="http://www.w3.org/2000/svg"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
    >
      <defs>
        {/* Glass body — subtle vertical gradient to fake specular falloff. */}
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c9c4bd" stopOpacity="0.55" />
        </linearGradient>

        {/* Liquid — uses the accent token so the vial reads as brand-colored. */}
        <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.75" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" />
        </linearGradient>

        {/* Edge shine that runs vertically down the left face of the glass. */}
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Metal cap */}
        <linearGradient id={capId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f1b17" />
          <stop offset="50%" stopColor="#34302a" />
          <stop offset="100%" stopColor="#1f1b17" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="308" rx="38" ry="5" fill="#000" opacity="0.08" />

      {/* Cap */}
      <rect x="36" y="4" width="48" height="30" rx="3" fill={`url(#${capId})`} />
      {/* Cap seam */}
      <rect x="36" y="24" width="48" height="4" fill="#0e0b08" opacity="0.4" />
      {/* Crimp ring */}
      <rect x="34" y="34" width="52" height="10" rx="2" fill="#6d665c" />
      <rect x="34" y="34" width="52" height="2" fill="#ffffff" opacity="0.35" />

      {/* Neck */}
      <path
        d="M42 44 L42 58 Q38 62 36 68 L36 76 L84 76 L84 68 Q82 62 78 58 L78 44 Z"
        fill={`url(#${glassId})`}
        stroke="rgba(20,16,10,0.12)"
        strokeWidth="0.75"
      />

      {/* Body (glass) */}
      <rect
        x="28"
        y="76"
        width="64"
        height="216"
        rx="8"
        fill={`url(#${glassId})`}
        stroke="rgba(20,16,10,0.12)"
        strokeWidth="0.75"
      />

      {/* Liquid — fills bottom ~65% of the body.
       * The wrapping <g> is targeted by the `hero-liquid` keyframe in globals.css
       * for the meniscus brightness pulse. */}
      <g style={{ animation: "hero-liquid 4.5s ease-in-out infinite", color: "var(--accent)" }}>
        {/* Liquid column */}
        <rect x="30" y="152" width="60" height="138" rx="6" fill={`url(#${liquidId})`} />
        {/* Meniscus — lighter ellipse at the fluid surface */}
        <ellipse cx="60" cy="152" rx="30" ry="3.5" fill="currentColor" opacity="0.5" />
        {/* Tiny shine on the meniscus */}
        <ellipse cx="52" cy="151" rx="8" ry="1.2" fill="#fff" opacity="0.5" />
      </g>

      {/* Label */}
      <rect x="32" y="176" width="56" height="88" rx="2" fill="#fbf8f3" opacity="0.94" />
      <rect
        x="32"
        y="176"
        width="56"
        height="88"
        rx="2"
        fill="none"
        stroke="rgba(20,16,10,0.08)"
        strokeWidth="0.75"
      />
      {/* Brand stripe */}
      <rect x="32" y="176" width="56" height="10" fill="currentColor" opacity="0.9" />
      {/* Label lines */}
      <rect x="38" y="196" width="30" height="3" rx="1" fill="#1a1612" opacity="0.75" />
      <rect x="38" y="204" width="44" height="2" rx="1" fill="#1a1612" opacity="0.35" />
      <rect x="38" y="210" width="38" height="2" rx="1" fill="#1a1612" opacity="0.35" />
      <rect x="38" y="216" width="42" height="2" rx="1" fill="#1a1612" opacity="0.35" />
      <rect x="38" y="224" width="26" height="2" rx="1" fill="#1a1612" opacity="0.35" />
      {/* Barcode-ish marks */}
      <g fill="#1a1612" opacity="0.55">
        <rect x="38" y="240" width="1.5" height="14" />
        <rect x="41" y="240" width="0.8" height="14" />
        <rect x="43" y="240" width="2" height="14" />
        <rect x="47" y="240" width="0.8" height="14" />
        <rect x="49" y="240" width="1.5" height="14" />
        <rect x="53" y="240" width="2.5" height="14" />
        <rect x="58" y="240" width="0.8" height="14" />
        <rect x="60" y="240" width="1.5" height="14" />
        <rect x="64" y="240" width="2" height="14" />
        <rect x="68" y="240" width="0.8" height="14" />
        <rect x="70" y="240" width="1.8" height="14" />
        <rect x="74" y="240" width="1" height="14" />
      </g>

      {/* Left edge glass shine */}
      <rect x="30" y="80" width="2" height="208" fill={`url(#${shineId})`} />
      {/* Right inner highlight */}
      <rect x="86" y="90" width="1.4" height="180" fill="#fff" opacity="0.35" rx="0.7" />

      {/* Bottom curve shadow for a bit of 3D */}
      <rect x="28" y="282" width="64" height="10" rx="6" fill="#000" opacity="0.1" />
    </svg>
  )
}
