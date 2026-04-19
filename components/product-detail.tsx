"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Plus, ShieldCheck, Truck, FlaskConical } from "lucide-react"
import { useCart } from "@/context/cart-context"
import {
  getUniqueStrengths,
  getFormsForStrength,
  type Product,
} from "@/lib/products-catalog"

type Props = {
  product: Product
}

/**
 * Variant picker + add-to-cart for `/products/[slug]`.
 *
 * Mirrors the interaction model on the homepage grid (two-dimensional
 * strength × form selector) but renders at a larger, more readable size and
 * surfaces the full description, purity badge, and trust bullets for users
 * who arrive on the detail page directly from email or organic search.
 */
export function ProductDetail({ product }: Props) {
  const strengths = useMemo(() => getUniqueStrengths(product.variants), [product])
  const [strength, setStrength] = useState(strengths[0])
  const formsForStrength = useMemo(
    () => getFormsForStrength(product.variants, strength),
    [product, strength],
  )
  const [form, setForm] = useState(formsForStrength[0])
  const [justAdded, setJustAdded] = useState(false)
  const { addItem } = useCart()

  // Whenever `strength` changes we may be stranded on a form that doesn't
  // exist for the new strength — reconcile to the first available.
  const resolvedForm = formsForStrength.includes(form) ? form : formsForStrength[0]

  const activeVariant =
    product.variants.find((v) => v.strength === strength && v.form === resolvedForm) ??
    product.variants[0]

  const showStrengthPicker = strengths.length > 1
  const showFormPicker = formsForStrength.length > 1

  function handleAdd() {
    addItem({
      id: product.id,
      name: product.name,
      variant: `${strength} — ${resolvedForm}`,
      price: activeVariant.price,
      quantity: 1,
      image: product.image,
    })
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-accent">
          {product.category}
        </p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight text-foreground text-balance">
          {product.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Purity {product.purity}
          </Badge>
          {product.popular && (
            <Badge className="bg-accent text-accent-foreground text-xs">Popular</Badge>
          )}
          {!product.inStock && (
            <Badge variant="secondary" className="text-xs">
              Out of stock
            </Badge>
          )}
        </div>
      </div>

      <p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-pretty">
        {product.description}
      </p>

      {/* Strength picker */}
      {showStrengthPicker && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            1. Strength
          </p>
          <div className="flex flex-wrap gap-2">
            {strengths.map((s) => {
              const active = s === strength
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStrength(s)}
                  aria-pressed={active}
                  className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-foreground/40"
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Form picker */}
      {showFormPicker && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            {showStrengthPicker ? "2. Option" : "Option"}
          </p>
          <div className="flex flex-wrap gap-2">
            {formsForStrength.map((f) => {
              const active = f === resolvedForm
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm(f)}
                  aria-pressed={active}
                  className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-foreground/40"
                  }`}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Price + add to cart */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
        <span className="font-serif text-3xl sm:text-4xl text-foreground tabular-nums">
          ${activeVariant.price.toFixed(2)}
        </span>
        <Button
          size="lg"
          disabled={!product.inStock || justAdded}
          onClick={handleAdd}
          className="gap-2 h-12 px-6 w-full sm:w-auto"
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4" />
              <span>Added to cart</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Add to cart</span>
            </>
          )}
        </Button>
      </div>

      {/* Trust bullets */}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border/60">
        <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <FlaskConical className="h-4 w-4 mt-0.5 text-accent shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-foreground font-medium">Third-party tested</span>
            Independent HPLC/MS verification
          </span>
        </li>
        <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-accent shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-foreground font-medium">98%+ purity</span>
            Full COA on request
          </span>
        </li>
        <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Truck className="h-4 w-4 mt-0.5 text-accent shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-foreground font-medium">Fast US shipping</span>
            Discreet packaging, tracked
          </span>
        </li>
      </ul>
    </div>
  )
}
