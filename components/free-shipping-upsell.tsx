"use client"

/**
 * Free-shipping progress + 1-click upsell suggestions.
 *
 * Replaces the old passive "Add $X for free US shipping" text with an
 * interactive nudge that actually lets shoppers close the gap in a
 * single click. Three kinds of suggestions are scored and the top two
 * are surfaced:
 *
 *   1. "upgrade"  — swap a Single Vial/Bottle/Pack in the cart for
 *                   the Kit of 10 at the same strength. This has the
 *                   best customer value story ("save ~55% per vial")
 *                   and typically delivers the largest cart-value
 *                   jump, so it usually wins when available.
 *
 *   2. "quantity" — bump an existing line item by +1. Zero friction,
 *                   zero new line items on the order, and the
 *                   shopper already wanted this product.
 *
 *   3. "addon"    — add a complementary accessory (bacteriostatic
 *                   water, syringes, or the starter kit). These are
 *                   items every peptide buyer actually needs, not
 *                   random filler, so the suggestion feels helpful.
 *
 * Each candidate gets a fit score that rewards closing the gap
 * exactly and penalises overshoot. Candidates that would unlock free
 * shipping in one click always rank above ones that only partially
 * fill the gap.
 *
 * Only renders when the cart is below the threshold — qualified carts
 * render nothing so this block disappears cleanly from the order
 * summary once the shopper has earned the perk.
 */

import { useMemo } from "react"
import { useCart, type CartItem } from "@/context/cart-context"
import { products } from "@/lib/products-catalog"
import { US_FREE_SHIPPING_THRESHOLD } from "@/lib/shipping"
import { Truck, TrendingUp, Plus } from "lucide-react"

// "Single X" form labels used by the catalog. The matching bulk form
// is always "Kit of 10 Xes", so we don't need a separate map — we
// just look for a variant at the same strength whose form starts
// with "Kit of 10".
const SINGLE_FORMS = new Set([
  "Single Vial",
  "Single Bottle",
  "Single Box",
  "Single Pack",
  "Single Kit",
])

// Preferred accessory product ids, in priority order. Bac water 30ml
// is first because it's the single most-added accessory for any
// lyophilised peptide; syringes second; the starter kit is third
// because it's a larger upsell that bundles the first two.
const PREFERRED_ADDON_IDS = [46, 48, 45, 47]

type Suggestion =
  | {
      kind: "upgrade"
      label: string
      description: string
      priceDelta: number
      apply: () => void
    }
  | {
      kind: "quantity"
      label: string
      description: string
      priceDelta: number
      apply: () => void
    }
  | {
      kind: "addon"
      label: string
      description: string
      priceDelta: number
      apply: () => void
    }

/**
 * Parse a cart variant string back into its strength + form. The cart
 * stores `"${strength} — ${form}"` with a unicode em dash, written by
 * `products.tsx#addItem` and `product-detail.tsx#handleAdd`. If the
 * format ever changes, upgrade suggestions silently stop firing —
 * they're a UX nudge, not a correctness requirement.
 */
function parseVariant(variant: string): { strength: string; form: string } | null {
  const parts = variant.split(" — ")
  if (parts.length !== 2) return null
  return { strength: parts[0], form: parts[1] }
}

/**
 * If the cart item is a Single X of a product that also sells a
 * Kit of 10 at the same strength, return the kit variant + the
 * dollar delta of upgrading a single unit. Otherwise null.
 */
function findKitUpgrade(
  item: CartItem,
): { form: string; strength: string; price: number; delta: number } | null {
  const parsed = parseVariant(item.variant)
  if (!parsed || !SINGLE_FORMS.has(parsed.form)) return null
  const product = products.find((p) => p.id === item.id)
  if (!product) return null
  const kit = product.variants.find(
    (v) => v.strength === parsed.strength && v.form.startsWith("Kit of 10"),
  )
  if (!kit) return null
  return {
    form: kit.form,
    strength: parsed.strength,
    price: kit.price,
    delta: kit.price - item.price,
  }
}

/**
 * Higher score = better fit for closing the free-shipping gap.
 *
 *   - Any candidate whose price delta is ≥ `remaining` qualifies and
 *     gets a large base score minus the overshoot (so a $55 delta
 *     into a $50 gap scores higher than a $200 delta into the same
 *     gap — we want minimal overshoot).
 *   - Candidates that only partially fill the gap get a smaller score
 *     proportional to how much of the gap they cover. These never
 *     rank above a qualifying candidate.
 */
function scoreFit(delta: number, remaining: number): number {
  if (delta <= 0) return -Infinity
  if (delta >= remaining) {
    return 10_000 - (delta - remaining)
  }
  return (delta / remaining) * 5_000
}

interface FreeShippingUpsellProps {
  className?: string
  /**
   * When true, render the compact variant used inside the checkout
   * order-summary card (smaller padding, fewer suggestions). Defaults
   * to false for the wider cart sidebar / standalone callers.
   */
  compact?: boolean
}

export function FreeShippingUpsell({
  className,
  compact = false,
}: FreeShippingUpsellProps) {
  const { items, total, addItem, updateQuantity } = useCart()

  const remaining = US_FREE_SHIPPING_THRESHOLD - total
  const progressPct = Math.min(
    100,
    Math.max(0, (total / US_FREE_SHIPPING_THRESHOLD) * 100),
  )

  const suggestions = useMemo<Suggestion[]>(() => {
    if (remaining <= 0 || items.length === 0) return []

    const candidates: Array<Suggestion & { score: number; key: string }> = []

    // 1. Upgrade any Single X to Kit of 10 at the same strength. We
    //    seed one candidate per eligible cart line; the scorer picks
    //    whichever one best closes the gap.
    for (const item of items) {
      const upgrade = findKitUpgrade(item)
      if (!upgrade) continue
      const kitLabel = `${upgrade.strength} — ${upgrade.form}`
      candidates.push({
        kind: "upgrade",
        label: `Upgrade to ${upgrade.form}`,
        description: `${item.name} · ${upgrade.strength} · save ~55% per vial`,
        priceDelta: upgrade.delta,
        score: scoreFit(upgrade.delta, remaining),
        key: `upgrade-${item.id}-${item.variant}`,
        apply: () => {
          // Decrement (or remove) one of the singles, then add the kit.
          // Using the updater form of setItems inside the hook keeps
          // these two sequential calls safe from stale-state races.
          if (item.quantity > 1) {
            updateQuantity(item.id, item.variant, item.quantity - 1)
          } else {
            // updateQuantity(…, 0) internally delegates to removeItem.
            updateQuantity(item.id, item.variant, 0)
          }
          addItem({
            id: item.id,
            name: item.name,
            variant: kitLabel,
            price: upgrade.price,
            quantity: 1,
            image: item.image,
          })
        },
      })
    }

    // 2. Quantity bumps on existing lines. We prefer these over new
    //    line items when the delta is similar because they keep the
    //    order visually tidy — no surprise extra rows the shopper
    //    didn't pick themselves.
    for (const item of items) {
      candidates.push({
        kind: "quantity",
        label: `Add another ${item.name}`,
        description: `+1 × ${item.variant}`,
        priceDelta: item.price,
        score: scoreFit(item.price, remaining),
        key: `quantity-${item.id}-${item.variant}`,
        apply: () => updateQuantity(item.id, item.variant, item.quantity + 1),
      })
    }

    // 3. Complementary accessories. Skip any product already in the
    //    cart (in any variant) so we don't suggest adding what the
    //    shopper has already decided on.
    const idsInCart = new Set(items.map((i) => i.id))
    for (const id of PREFERRED_ADDON_IDS) {
      if (idsInCart.has(id)) continue
      const product = products.find((p) => p.id === id)
      if (!product) continue
      const v = product.variants[0]
      if (!v) continue
      const variantLabel = `${v.strength} — ${v.form}`
      candidates.push({
        kind: "addon",
        label: `Add ${product.name}`,
        description:
          product.id === 46
            ? "For reconstituting peptides"
            : product.id === 48
              ? "1/2ml · 31G · 100 count"
              : product.id === 45
                ? "Syringes + bac water bundle"
                : `${v.strength} · ${v.form}`,
        priceDelta: v.price,
        score: scoreFit(v.price, remaining),
        key: `addon-${product.id}`,
        apply: () => {
          addItem({
            id: product.id,
            name: product.name,
            variant: variantLabel,
            price: v.price,
            quantity: 1,
            image: product.image,
          })
        },
      })
    }

    // Sort by fit score, then dedupe by visible label so we don't
    // show "Upgrade to Kit of 10" twice for different cart lines —
    // the top-scoring one wins.
    candidates.sort((a, b) => b.score - a.score)
    const seen = new Set<string>()
    const deduped: Suggestion[] = []
    for (const c of candidates) {
      const tag = `${c.kind}:${c.label}`
      if (seen.has(tag)) continue
      seen.add(tag)
      deduped.push(c)
      if (deduped.length >= (compact ? 2 : 3)) break
    }
    return deduped
  }, [items, remaining, addItem, updateQuantity, compact])

  // Qualified carts hide the whole block — nothing to upsell.
  if (remaining <= 0) return null

  const padding = compact ? "p-2.5" : "p-3"

  return (
    <div
      className={`rounded-lg border border-accent/20 bg-accent/5 ${padding} ${className ?? ""}`}
      role="group"
      aria-label="Free shipping progress and quick-add suggestions"
    >
      {/* Progress header */}
      <div className="flex items-start gap-2">
        <Truck className="h-4 w-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug">
            Add{" "}
            <span className="text-accent font-bold tabular-nums">
              ${remaining.toFixed(2)}
            </span>{" "}
            for{" "}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              free US
            </span>{" "}
            shipping
          </p>
          <div
            className="mt-1.5 h-1.5 w-full rounded-full bg-accent/15 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(progressPct)}% of the way to free shipping`}
          >
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Suggestion buttons */}
      {suggestions.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            One click to unlock it
          </p>
          {suggestions.map((s, idx) => {
            const qualifies = s.priceDelta >= remaining
            const Icon = s.kind === "upgrade" ? TrendingUp : Plus
            return (
              <button
                key={`${s.kind}-${idx}-${s.label}`}
                type="button"
                onClick={s.apply}
                className="w-full flex items-center gap-2 rounded-md bg-background border border-border hover:border-accent/60 hover:bg-accent/5 active:scale-[0.99] px-2.5 py-2 transition-all text-left"
              >
                <span
                  className={`flex items-center justify-center h-6 w-6 rounded-md shrink-0 ${
                    qualifies
                      ? "bg-accent text-accent-foreground"
                      : "bg-accent/10 text-accent"
                  }`}
                  aria-hidden="true"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-foreground truncate">
                    {s.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {s.description}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {qualifies && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-accent hidden sm:inline">
                      unlocks
                    </span>
                  )}
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    +${Math.round(s.priceDelta)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
