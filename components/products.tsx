"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Plus, Check, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useCart } from "@/context/cart-context"

const categories = [
  "All",
  "GLP-1",
  "Growth Hormone",
  "Recovery",
  "Cognitive",
  "Anti-Aging",
  "Research",
  "Accessories",
]

interface Variant {
  strength: string
  form: string
  price: number
}

interface Product {
  id: number
  name: string
  category: string
  description: string
  purity: string
  inStock: boolean
  popular: boolean
  image: string
  variants: Variant[]
}

// Helpers keep the product data concise.
// Every kit is exactly 4.5× the single-vial price (a 55% bulk discount on 10 vials).
function sv(strength: string, vialPrice: number): Variant[] {
  return [
    { strength, form: "Single Vial", price: vialPrice },
    { strength, form: "Kit of 10 Vials", price: Math.round(vialPrice * 4.5) },
  ]
}

const products: Product[] = [
  // ===== GLP-1 =====
  {
    id: 1,
    name: "Tirzepatide",
    category: "GLP-1",
    description: "Dual GIP and GLP-1 receptor agonist for metabolic research applications.",
    purity: "99.1%",
    inStock: true,
    popular: true,
    image: "/products/tirzepatide.jpg",
    variants: [
      ...sv("2mg", 60),
      ...sv("5mg", 80),
      ...sv("10mg", 120),
      ...sv("15mg", 180),
      ...sv("30mg", 280),
      ...sv("60mg", 540),
    ],
  },
  {
    id: 2,
    name: "Semaglutide",
    category: "GLP-1",
    description: "GLP-1 receptor agonist peptide for metabolic and appetite research.",
    purity: "99.3%",
    inStock: true,
    popular: true,
    image: "/products/semaglutide.jpg",
    variants: [
      ...sv("2mg", 50),
      ...sv("5mg", 76),
      ...sv("10mg", 140),
    ],
  },
  {
    id: 3,
    name: "Retatrutide",
    category: "GLP-1",
    description: "Triple agonist targeting GLP-1, GIP, and glucagon receptors.",
    purity: "99.2%",
    inStock: true,
    popular: true,
    image: "/products/retatrutide.jpg",
    variants: [
      ...sv("10mg", 180),
      ...sv("20mg", 260),
    ],
  },
  {
    id: 4,
    name: "Cagrilintide",
    category: "GLP-1",
    description: "Amylin analogue for appetite and metabolic research.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/cagrilintide.jpg",
    variants: [
      ...sv("5mg", 80),
      ...sv("10mg", 160),
    ],
  },
  {
    id: 5,
    name: "AOD-9604",
    category: "GLP-1",
    description: "Synthetic fragment of human growth hormone for fat metabolism research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/aod-9604.jpg",
    variants: [
      ...sv("2mg", 60),
      ...sv("5mg", 120),
    ],
  },

  // ===== Growth Hormone =====
  {
    id: 6,
    name: "Sermorelin",
    category: "Growth Hormone",
    description: "Growth hormone releasing hormone analog for research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/sermorelin.jpg",
    variants: [
      ...sv("2mg", 60),
      ...sv("5mg", 100),
    ],
  },
  {
    id: 7,
    name: "Tesamorelin",
    category: "Growth Hormone",
    description: "Stabilized GHRH analog used in visceral adipose research.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/tesamorelin.jpg",
    variants: [
      ...sv("2mg", 60),
      ...sv("5mg", 120),
      ...sv("10mg", 160),
    ],
  },
  {
    id: 8,
    name: "CJC-1295 (with DAC)",
    category: "Growth Hormone",
    description: "Long-acting GHRH analog with drug affinity complex for sustained release.",
    purity: "99.1%",
    inStock: true,
    popular: true,
    image: "/products/cjc-1295-dac.jpg",
    variants: [
      ...sv("2mg", 60),
    ],
  },
  {
    id: 9,
    name: "CJC-1295 (no DAC)",
    category: "Growth Hormone",
    description: "Short-acting GHRH analog without drug affinity complex.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/cjc-1295-no-dac.jpg",
    variants: [
      ...sv("2mg", 40),
      ...sv("5mg", 60),
      ...sv("10mg", 100),
    ],
  },
  {
    id: 10,
    name: "Ipamorelin",
    category: "Growth Hormone",
    description: "Selective growth hormone secretagogue peptide.",
    purity: "99.2%",
    inStock: true,
    popular: true,
    image: "/products/ipamorelin.jpg",
    variants: [
      ...sv("2mg", 30),
      ...sv("5mg", 40),
      ...sv("10mg", 70),
    ],
  },
  {
    id: 11,
    name: "Hexarelin",
    category: "Growth Hormone",
    description: "Potent growth hormone releasing peptide.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/hexarelin.jpg",
    variants: [
      ...sv("2mg", 40),
      ...sv("5mg", 80),
    ],
  },
  {
    id: 12,
    name: "GHRP-2",
    category: "Growth Hormone",
    description: "Growth hormone releasing peptide with potent GH-stimulating effects.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/ghrp-2.jpg",
    variants: [
      ...sv("2mg", 24),
      ...sv("5mg", 36),
    ],
  },
  {
    id: 13,
    name: "HGH",
    category: "Growth Hormone",
    description: "Recombinant human growth hormone for somatropin research.",
    purity: "99.5%",
    inStock: true,
    popular: true,
    image: "/products/hgh.jpg",
    variants: [
      ...sv("10 IU", 60),
    ],
  },
  {
    id: 14,
    name: "IGF-1 LR3",
    category: "Growth Hormone",
    description: "Long R3 insulin-like growth factor for cellular research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/igf-1-lr3.jpg",
    variants: [
      ...sv("0.1mg", 60),
      ...sv("1mg", 240),
    ],
  },
  {
    id: 15,
    name: "PEG MGF",
    category: "Growth Hormone",
    description: "PEGylated mechano growth factor for extended activity research.",
    purity: "98.7%",
    inStock: true,
    popular: false,
    image: "/products/peg-mgf.jpg",
    variants: [
      ...sv("5mg", 60),
    ],
  },
  {
    id: 16,
    name: "MK-677 (Ibutamoren)",
    category: "Growth Hormone",
    description: "Oral ghrelin receptor agonist for growth hormone research (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/mk-677.jpg",
    variants: [
      { strength: "Tablets", form: "Bottle", price: 240 },
    ],
  },

  // ===== Recovery =====
  {
    id: 17,
    name: "BPC-157",
    category: "Recovery",
    description: "Body protective compound for tissue repair and gut health research.",
    purity: "99.4%",
    inStock: true,
    popular: true,
    image: "/products/bpc-157.jpg",
    variants: [
      ...sv("2mg", 30),
      ...sv("5mg", 50),
      ...sv("10mg", 90),
    ],
  },
  {
    id: 18,
    name: "Thymosin Beta-4 (TB-500)",
    category: "Recovery",
    description: "Beta-thymosin peptide for tissue regeneration research.",
    purity: "99.2%",
    inStock: true,
    popular: true,
    image: "/products/tb-500.jpg",
    variants: [
      ...sv("2mg", 50),
      ...sv("5mg", 70),
      ...sv("10mg", 120),
    ],
  },
  {
    id: 19,
    name: "GHK-Cu",
    category: "Recovery",
    description: "Copper tripeptide for skin and tissue healing research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/ghk-cu.jpg",
    variants: [
      ...sv("50mg", 50),
      ...sv("100mg", 80),
    ],
  },
  {
    id: 20,
    name: "Thymosin Alpha-1",
    category: "Recovery",
    description: "Immunomodulatory peptide for immune function research.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/thymosin-alpha-1.jpg",
    variants: [
      ...sv("5mg", 100),
      ...sv("10mg", 160),
    ],
  },
  {
    id: 21,
    name: "KPV",
    category: "Recovery",
    description: "Anti-inflammatory tripeptide for gut and tissue research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/kpv.jpg",
    variants: [
      ...sv("10mg", 60),
    ],
  },
  {
    id: 22,
    name: "Thymulin",
    category: "Recovery",
    description: "Zinc-bound thymic peptide for immune research applications.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/thymulin.jpg",
    variants: [
      ...sv("10mg", 80),
    ],
  },

  // ===== Cognitive =====
  {
    id: 23,
    name: "Semax",
    category: "Cognitive",
    description: "Neuropeptide for cognitive and neuroprotective research.",
    purity: "99.1%",
    inStock: true,
    popular: false,
    image: "/products/semax.jpg",
    variants: [
      ...sv("10mg", 80),
    ],
  },
  {
    id: 24,
    name: "Selank",
    category: "Cognitive",
    description: "Anxiolytic peptide for anxiety and cognition research.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/selank.jpg",
    variants: [
      ...sv("5mg", 50),
    ],
  },
  {
    id: 25,
    name: "DSIP",
    category: "Cognitive",
    description: "Delta sleep-inducing peptide for sleep cycle research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/dsip.jpg",
    variants: [
      ...sv("5mg", 80),
    ],
  },
  {
    id: 26,
    name: "Pinealon",
    category: "Cognitive",
    description: "Tripeptide bioregulator for neuronal and cognitive research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/pinealon.jpg",
    variants: [
      ...sv("16mg", 80),
    ],
  },

  // ===== Anti-Aging =====
  {
    id: 27,
    name: "Epithalon",
    category: "Anti-Aging",
    description: "Tetrapeptide for telomere and longevity research.",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/epithalon.jpg",
    variants: [
      ...sv("10mg", 60),
    ],
  },
  {
    id: 28,
    name: "NAD+",
    category: "Anti-Aging",
    description: "Nicotinamide adenine dinucleotide for mitochondrial research.",
    purity: "99.2%",
    inStock: true,
    popular: true,
    image: "/products/nad.jpg",
    variants: [
      ...sv("500mg", 60),
    ],
  },
  {
    id: 29,
    name: "NMN",
    category: "Anti-Aging",
    description: "Nicotinamide mononucleotide for NAD+ precursor research (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/nmn.jpg",
    variants: [
      { strength: "Tablets", form: "Bottle", price: 120 },
    ],
  },
  {
    id: 30,
    name: "MOTS-C",
    category: "Anti-Aging",
    description: "Mitochondrial-derived peptide for metabolic and aging research.",
    purity: "99.1%",
    inStock: true,
    popular: false,
    image: "/products/mots-c.jpg",
    variants: [
      ...sv("10mg", 140),
    ],
  },
  {
    id: 31,
    name: "SS31",
    category: "Anti-Aging",
    description: "Mitochondria-targeted peptide for oxidative stress research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/ss31.jpg",
    variants: [
      ...sv("10mg", 140),
    ],
  },
  {
    id: 32,
    name: "Snap-8",
    category: "Anti-Aging",
    description: "Octapeptide for skincare and neuromodulatory research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/snap-8.jpg",
    variants: [
      ...sv("10mg", 60),
    ],
  },
  {
    id: 33,
    name: "PE 22-28",
    category: "Anti-Aging",
    description: "Spadin derivative for neuroplasticity and mood research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/pe-22-28.jpg",
    variants: [
      ...sv("8mg", 60),
    ],
  },

  // ===== Research =====
  {
    id: 34,
    name: "PT-141",
    category: "Research",
    description: "Melanocortin receptor agonist for sexual health research.",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/pt-141.jpg",
    variants: [
      ...sv("5mg", 50),
      ...sv("10mg", 90),
    ],
  },
  {
    id: 35,
    name: "Melanotan 2",
    category: "Research",
    description: "Synthetic analog of alpha-melanocyte-stimulating hormone.",
    purity: "98.7%",
    inStock: true,
    popular: false,
    image: "/products/melanotan-2.jpg",
    variants: [
      ...sv("10mg", 50),
    ],
  },
  {
    id: 36,
    name: "Oxytocin Acetate",
    category: "Research",
    description: "Nine-amino-acid peptide hormone for social behavior research.",
    purity: "99.1%",
    inStock: true,
    popular: false,
    image: "/products/oxytocin.jpg",
    variants: [
      ...sv("2mg", 60),
    ],
  },
  {
    id: 37,
    name: "Kisspeptin-10",
    category: "Research",
    description: "GPR54 agonist peptide for reproductive endocrinology research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/kisspeptin-10.jpg",
    variants: [
      ...sv("5mg", 80),
    ],
  },
  {
    id: 38,
    name: "HCG",
    category: "Research",
    description: "Human chorionic gonadotropin for endocrine research.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/hcg.jpg",
    variants: [
      ...sv("5000 IU", 80),
    ],
  },
  {
    id: 39,
    name: "HMG",
    category: "Research",
    description: "Human menopausal gonadotropin for reproductive research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/hmg.jpg",
    variants: [
      ...sv("75 IU", 60),
    ],
  },
  {
    id: 40,
    name: "FST344",
    category: "Research",
    description: "Follistatin 344 for myostatin inhibition research.",
    purity: "98.7%",
    inStock: true,
    popular: false,
    image: "/products/fst344.jpg",
    variants: [
      ...sv("1mg", 180),
    ],
  },
  {
    id: 41,
    name: "GDF-8 (Myostatin)",
    category: "Research",
    description: "Growth differentiation factor 8 for muscle biology research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/gdf-8.jpg",
    variants: [
      ...sv("1mg", 160),
    ],
  },
  {
    id: 42,
    name: "GW501516 (Cardarine)",
    category: "Research",
    description: "PPAR-delta agonist research compound (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/gw501516.jpg",
    variants: [
      { strength: "Tablets", form: "Bottle", price: 160 },
    ],
  },
  {
    id: 43,
    name: "SLU-PP-332",
    category: "Research",
    description: "ERR agonist research compound (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/slu-pp-332.jpg",
    variants: [
      { strength: "Tablets", form: "Bottle", price: 160 },
    ],
  },
  {
    id: 44,
    name: "GLOW Blend",
    category: "Research",
    description: "Blend of BPC-157 / TB-500 / GHK-Cu for tissue research.",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/glow-blend.jpg",
    variants: [
      ...sv("10/10/75mg", 240),
    ],
  },

  // ===== Accessories =====
  {
    id: 45,
    name: "Starter Kit",
    category: "Accessories",
    description: "Syringe plus 30ml bacteriostatic water — everything needed to get started.",
    purity: "Sterile",
    inStock: true,
    popular: true,
    image: "/products/starter-bundle.jpg",
    variants: [
      { strength: "Standard", form: "Single Kit", price: 60 },
      { strength: "Standard", form: "Kit of 10", price: 270 },
    ],
  },
  {
    id: 46,
    name: "Bacteriostatic Water 30ml",
    category: "Accessories",
    description: "Sterile bacteriostatic water for reconstitution. 30ml bottle.",
    purity: "Sterile",
    inStock: true,
    popular: true,
    image: "/products/bacteriostatic-water.jpg",
    variants: [
      { strength: "30ml", form: "Single Bottle", price: 40 },
      { strength: "30ml", form: "Kit of 10 Bottles", price: 180 },
    ],
  },
  {
    id: 47,
    name: "Bacteriostatic Water 3ml",
    category: "Accessories",
    description: "Sterile bacteriostatic water for reconstitution. Box of 10 × 3ml bottles.",
    purity: "Sterile",
    inStock: true,
    popular: false,
    image: "/products/bac-water-3ml.jpg",
    variants: [
      { strength: "3ml × 10", form: "Single Box", price: 10 },
      { strength: "3ml × 10", form: "Kit of 10 Boxes", price: 45 },
    ],
  },
  {
    id: 48,
    name: "Insulin Syringes",
    category: "Accessories",
    description: "1/2ml — 31G × 8mm. Sterile insulin syringes for precise peptide administration. 100 count per pack.",
    purity: "Sterile",
    inStock: true,
    popular: true,
    image: "/products/insulin-syringes.jpg",
    variants: [
      { strength: "100 ct", form: "Single Pack", price: 30 },
      { strength: "100 ct", form: "Kit of 10 Packs", price: 135 },
    ],
  },
]

// Selection shape stored per product: { strength, form }
type Selection = { strength: string; form: string }

function getUniqueStrengths(variants: Variant[]): string[] {
  return Array.from(new Set(variants.map((v) => v.strength)))
}
function getFormsForStrength(variants: Variant[], strength: string): string[] {
  return Array.from(new Set(variants.filter((v) => v.strength === strength).map((v) => v.form)))
}

export function Products() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [addedToCart, setAddedToCart] = useState<number[]>([])
  const { addItem } = useCart()

  // Initialize each product's selection: first strength, first form of that strength.
  const [selection, setSelection] = useState<Record<number, Selection>>(() => {
    const initial: Record<number, Selection> = {}
    for (const product of products) {
      const strengths = getUniqueStrengths(product.variants)
      const defaultStrength = strengths[0]
      const defaultForm = getFormsForStrength(product.variants, defaultStrength)[0]
      initial[product.id] = { strength: defaultStrength, form: defaultForm }
    }
    return initial
  })

  function setStrength(productId: number, strength: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const forms = getFormsForStrength(product.variants, strength)
    setSelection((prev) => ({
      ...prev,
      [productId]: {
        strength,
        // Preserve the previously selected form if it exists for this strength, else pick first.
        form: forms.includes(prev[productId]?.form) ? prev[productId].form : forms[0],
      },
    }))
  }

  function setForm(productId: number, form: string) {
    setSelection((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], form },
    }))
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory
        if (!matchesCategory) return false
        if (!normalizedQuery) return true
        return (
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.description.toLowerCase().includes(normalizedQuery) ||
          p.category.toLowerCase().includes(normalizedQuery)
        )
      }),
    [selectedCategory, normalizedQuery],
  )

  const handleAddToCart = (id: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const sel = selection[id]
    if (!sel) return

    const variantData = product.variants.find((v) => v.strength === sel.strength && v.form === sel.form)
    if (!variantData) return

    // Combine strength + form into a single human-readable label for the cart/order record.
    const variantLabel = `${sel.strength} — ${sel.form}`

    addItem({
      id: product.id,
      name: product.name,
      variant: variantLabel,
      price: variantData.price,
      quantity: 1,
      image: product.image,
    })

    setAddedToCart((prev) => [...prev, id])
    setTimeout(() => {
      setAddedToCart((prev) => prev.filter((i) => i !== id))
    }, 2000)
  }

  return (
    <section id="products" className="py-16 sm:py-24 lg:py-32 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            Our Collection
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-foreground text-balance">
            Premium Research Peptides
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            All compounds undergo rigorous third-party testing to ensure the highest quality for your research needs.
          </p>
        </div>

        {/* Search bar */}
        <div className="mx-auto max-w-xl mb-4 sm:mb-6">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search peptides by name, category, or description"
              aria-label="Search products"
              className="h-12 rounded-full pl-11 pr-11 bg-background shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6 sm:mb-10 -mx-4 sm:mx-0">
          <div className="flex sm:flex-wrap sm:justify-center gap-2 overflow-x-auto no-scrollbar px-4 sm:px-0 pb-1 snap-x snap-mandatory">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="rounded-full shrink-0 snap-start h-9"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {(normalizedQuery || selectedCategory !== "All") && (
          <p className="text-center text-sm text-muted-foreground mb-6 sm:mb-8" aria-live="polite">
            {filteredProducts.length === 0
              ? "No products found"
              : `Showing ${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`}
            {normalizedQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
          </p>
        )}

        {/* Empty state */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16 sm:py-24">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-xl sm:text-2xl text-foreground mb-2">No matches found</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Try a different search term or clear the filters to see all products.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
              }}
            >
              Reset filters
            </Button>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredProducts.map((product) => {
            const strengths = getUniqueStrengths(product.variants)
            const sel = selection[product.id]
            const forms = sel ? getFormsForStrength(product.variants, sel.strength) : []
            const activeVariant = product.variants.find(
              (v) => v.strength === sel?.strength && v.form === sel?.form,
            )
            const price = activeVariant?.price ?? product.variants[0].price
            const showStrengthPicker = strengths.length > 1
            const showFormPicker = forms.length > 1

            return (
              <Card
                key={product.id}
                className="group overflow-hidden border-border/50 hover:border-border hover:shadow-lg transition-all duration-300"
              >
                <CardContent className="p-0">
                  {/* Product Image Area */}
                  <div className="relative aspect-square bg-secondary/50 flex items-center justify-center overflow-hidden">
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.popular && (
                      <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Popular</Badge>
                    )}
                    {!product.inStock && (
                      <Badge variant="secondary" className="absolute top-3 right-3">
                        Out of Stock
                      </Badge>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-base sm:text-lg text-foreground group-hover:text-accent transition-colors truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">{sel?.strength}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                        {product.purity}
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Strength picker */}
                    {showStrengthPicker && (
                      <div className="mb-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                          1. Select strength
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {strengths.map((s) => {
                            const active = s === sel?.strength
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setStrength(product.id, s)}
                                aria-pressed={active}
                                className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
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
                      <div className="mb-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                          {showStrengthPicker ? "2. Select option" : "Select option"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {forms.map((f) => {
                            const active = f === sel?.form
                            return (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setForm(product.id, f)}
                                aria-pressed={active}
                                className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
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

                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-xl sm:text-2xl text-foreground">${price.toFixed(2)}</span>
                      <Button
                        size="sm"
                        disabled={!product.inStock || addedToCart.includes(product.id)}
                        onClick={() => handleAddToCart(product.id)}
                        className="gap-1.5 h-9 px-3 sm:px-4 shrink-0"
                      >
                        {addedToCart.includes(product.id) ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            <span>Add</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            View All Products
          </Button>
        </div>
      </div>
    </section>
  )
}
