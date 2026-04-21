"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, FlaskConical, ShieldCheck, Truck, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { VialMockup } from "@/components/vial-mockup"

/**
 * Runs a requestAnimationFrame-driven count-up from 0 → `target` once
 * `active` flips true. Eases cubic-out so the number slows toward the
 * end and the final value feels "settled".
 */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, active, duration])
  return value
}

type Stat = { value: number; suffix: string; label: string }
const STATS: Stat[] = [
  { value: 99, suffix: "%", label: "Purity Tested" },
  { value: 47, suffix: "+", label: "Peptide Products" },
  { value: 24, suffix: "h", label: "Fast Shipping" },
  { value: 100, suffix: "%", label: "Satisfaction" },
]

// Featured compounds — shown as pill-shaped "quick jump" chips under the
// CTAs so first-time visitors immediately see what we carry without
// having to scroll. All link into the on-page products grid.
const FEATURED = ["Tirzepatide", "Semaglutide", "Retatrutide", "BPC-157", "GHK-Cu"] as const

export function Hero() {
  // Intersection observer drives the stat count-up so it only fires when
  // the band is visible. Disconnects after the first trigger.
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsInView, setStatsInView] = useState(false)
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-background pt-20"
      aria-labelledby="hero-heading"
    >
      {/* Subtle grid — kept from the previous hero as a texture layer. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px] sm:bg-[size:64px_64px]"
      />

      {/* Radial accent glow behind the headline for depth. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-5xl aspect-square rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--accent) 18%, transparent) 0%, transparent 55%)",
        }}
      />

      {/* ---------- Vials ---------- */}
      {/* Right, large & tilted — cropped off the edge so it feels like a
       * real object on a shelf rather than a stamped illustration. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 sm:-right-8 lg:right-8 top-[8%] lg:top-[6%] w-[240px] sm:w-[300px] lg:w-[360px] opacity-[0.22] sm:opacity-30 lg:opacity-40 rotate-[14deg]"
      >
        <div className="animate-[hero-fade-in_1.2s_ease-out_200ms_both]">
          <div className="animate-[hero-float_9s_ease-in-out_infinite] drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)]">
            <VialMockup id="hero-vial-right" className="w-full h-auto" />
          </div>
        </div>
      </div>

      {/* Left, smaller & counter-tilted — visual balance for the right vial. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 sm:left-0 lg:left-10 top-[28%] lg:top-[18%] w-[160px] sm:w-[200px] lg:w-[240px] opacity-[0.18] sm:opacity-25 lg:opacity-30 -rotate-[10deg]"
      >
        <div className="animate-[hero-fade-in_1.2s_ease-out_400ms_both]">
          <div className="animate-[hero-float-slow_11s_ease-in-out_infinite] drop-shadow-[0_24px_48px_rgba(0,0,0,0.1)]">
            <VialMockup id="hero-vial-left" className="w-full h-auto" />
          </div>
        </div>
      </div>

      {/* ---------- Content ---------- */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 lg:px-8 lg:py-32 w-full">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow — doubles as a trust chip. */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 backdrop-blur px-3.5 py-1.5 text-xs sm:text-sm text-muted-foreground opacity-0 animate-[hero-fade-up_0.7s_ease-out_50ms_both]"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-medium uppercase tracking-widest text-[0.7rem]">
              Research Grade Peptides
            </span>
          </div>

          <h1
            id="hero-heading"
            className="mt-5 sm:mt-6 font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground max-w-5xl text-balance leading-[1.05] opacity-0 animate-[hero-fade-up_0.8s_ease-out_150ms_both]"
          >
            Premium peptides for{" "}
            <span className="relative inline-block">
              <span className="relative z-10">scientific excellence</span>
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-[0.3em] bg-accent/25 -z-0 rounded-sm"
              />
            </span>
          </h1>

          <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty leading-relaxed opacity-0 animate-[hero-fade-up_0.8s_ease-out_300ms_both]">
            Laboratory-tested compounds with verified purity. 47+ premium peptides including
            Tirzepatide, Semaglutide, Retatrutide, and more. Trusted by researchers worldwide.
          </p>

          {/* CTAs */}
          {/* Wrapper also holds the conversion microline underneath the
              pair — free-shipping + same-day dispatch removes purchase
              friction right at the decision point. */}
          <div className="mt-8 sm:mt-12 w-full sm:w-auto opacity-0 animate-[hero-fade-up_0.8s_ease-out_450ms_both]">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              {/* Primary: transactional copy ("Buy Now") — strongest
                  purchase-intent verb, matching the CTA language
                  shoppers already see on product tiles. The old
                  Sparkles glyph was dropped so nothing competes with
                  the wordmark; label is bumped up to text-base /
                  text-lg for a more confident, clickable presence
                  and the button is a bit taller to keep the vertical
                  rhythm in balance. Arrow stays as the sole icon to
                  preserve motion affordance. */}
              <Button
                size="lg"
                className="group relative gap-2.5 px-10 h-14 w-full sm:w-auto text-base sm:text-lg font-semibold shadow-sm shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-accent/30 focus-visible:-translate-y-0.5"
                asChild
              >
                <Link href="#products">
                  Buy Now
                  <ArrowRight
                    className="h-5 w-5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
              {/* Secondary: concrete ("See the Science") rather than the
                  generic "Learn More". Signals scientific rigor for the
                  skeptical buyer. Mirrors the primary's icon-left pattern
                  with FlaskConical to create a semantic pair. */}
              <Button
                size="lg"
                variant="outline"
                className="group gap-2 px-8 h-12 w-full sm:w-auto transition-colors hover:border-accent hover:text-accent hover:bg-accent/5"
                asChild
              >
                <Link href="#science">
                  <FlaskConical
                    className="h-4 w-4 transition-transform group-hover:rotate-6"
                    aria-hidden="true"
                  />
                  See the Science
                </Link>
              </Button>
            </div>

            {/* Conversion microline — factual, matches promises enforced
                in lib/shipping.ts and the trust strip. Kept small so the
                CTA pair remains the visual anchor. */}
            <p className="mt-3 text-xs text-muted-foreground/80 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3 w-3 text-accent" aria-hidden="true" />
                Free US shipping over $500
              </span>
              <span className="mx-2 text-muted-foreground/40" aria-hidden="true">
                ·
              </span>
              <span>Ships within 24h</span>
            </p>
          </div>

          {/* Featured peptide chips — intuitive "here's what we carry" preview. */}
          <div
            className="mt-6 sm:mt-8 w-full max-w-3xl opacity-0 animate-[hero-fade-up_0.8s_ease-out_600ms_both]"
            aria-label="Featured peptides"
          >
            <div className="flex items-center justify-center gap-2 mb-3 text-[0.7rem] uppercase tracking-widest text-muted-foreground/80">
              <span className="h-px w-8 bg-border" aria-hidden="true" />
              Most researched
              <span className="h-px w-8 bg-border" aria-hidden="true" />
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {FEATURED.map((name) => (
                <li key={name}>
                  <Link
                    href="#products"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur px-3.5 py-1.5 text-sm text-foreground transition-all hover:border-foreground hover:bg-foreground hover:text-background"
                  >
                    {name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="#products"
                  className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-accent/10 text-accent px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  See all 47+
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Inline trust row — small icons that reinforce the eyebrow's promise. */}
          <ul
            className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs sm:text-sm text-muted-foreground opacity-0 animate-[hero-fade-up_0.8s_ease-out_750ms_both]"
            aria-label="Key benefits"
          >
            <li className="inline-flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>Third-party HPLC tested</span>
            </li>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>Verified {">"}99% purity</span>
            </li>
            <li className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>Ships within 24 hours</span>
            </li>
          </ul>

          {/* Stats — count up on first view. */}
          <div
            ref={statsRef}
            className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-16 w-full max-w-3xl opacity-0 animate-[hero-fade-up_0.8s_ease-out_900ms_both]"
          >
            {STATS.map((s) => (
              <HeroStat key={s.label} stat={s} active={statsInView} />
            ))}
          </div>
        </div>
      </div>

      {/* Scroll hint — purely decorative, fades up after the rest of the hero. */}
      <Link
        href="#products"
        aria-label="Scroll to products"
        className="group absolute left-1/2 bottom-4 sm:bottom-6 -translate-x-1/2 flex flex-col items-center gap-1.5 text-muted-foreground/70 hover:text-foreground transition-colors opacity-0 animate-[hero-fade-in_1s_ease-out_1200ms_both]"
      >
        <span className="text-[0.65rem] uppercase tracking-[0.2em]">Explore</span>
        <span className="relative block h-7 w-[18px] rounded-full border border-current overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1.5 -translate-x-1/2 h-1.5 w-[2px] rounded-full bg-current animate-[hero-scroll-hint_1.8s_ease-in-out_infinite]"
          />
        </span>
        <ChevronDown
          className="h-3 w-3 transition-transform group-hover:translate-y-0.5"
          aria-hidden="true"
        />
      </Link>
    </section>
  )
}

function HeroStat({ stat, active }: { stat: Stat; active: boolean }) {
  const v = useCountUp(stat.value, active)
  return (
    <div className="flex flex-col items-center">
      <span className="font-serif text-3xl sm:text-4xl md:text-5xl text-foreground tabular-nums">
        {v}
        {stat.suffix}
      </span>
      <span className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">{stat.label}</span>
    </div>
  )
}
