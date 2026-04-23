/**
 * Storefront product catalog.
 *
 * This is the single source of truth for what PeptideXM sells. The homepage
 * grid, the product detail page at `/products/[slug]`, and any future surface
 * (search index, sitemap, structured data) all read from here. The `slug`
 * values are derived from `name` and are expected to match the `slug` column
 * on public.products — the admin product picker writes tokens like
 * `[[product:aod-9604]]` whose slugs need to resolve to a detail page URL.
 *
 * This module intentionally has no React or client-side imports so it can be
 * consumed from server components and route handlers without pulling in the
 * client grid's bundle.
 */

export interface Variant {
  strength: string
  form: string
  price: number
}

export interface Product {
  id: number
  name: string
  category: string
  description: string
  purity: string
  inStock: boolean
  popular: boolean
  /**
   * Optional flag for products where inventory is genuinely tight. Surfaces
   * a "Only a few kits left" urgency indicator on the card and detail page.
   * Leave undefined for the majority of items — the urgency signal has to
   * stay legitimate to stay effective.
   */
  limitedStock?: boolean
  /**
   * Optional URL slug override. When present this wins over the
   * name-derived slug for both `/products/[slug]` routing and for the
   * email/blog embed helpers. Use it whenever the public.products row
   * uses a shorter canonical slug than the display name would produce —
   * for example `"CJC-1295 (no DAC)"` auto-slugs to `"cjc-1295-no-dac"`,
   * but the DB row is just `cjc-1295`. Keeping these aligned is what
   * makes the email CTA links resolve.
   */
  slug?: string
  image: string
  variants: Variant[]
  /**
   * Hidden search-only aliases. These terms match in the header
   * autocomplete and the products grid filter, but are never
   * rendered in the UI — no card, no detail page, no meta tag
   * shows them. They exist purely to keep search useful for
   * customers who know a compound by a different name than our
   * catalog uses.
   *
   * Primary use case: the four XM-* metabolic products were
   * rebranded from scientific names (tirzepatide, semaglutide,
   * retatrutide, cagrilintide) to neutral codes to comply with
   * FDA enforcement on branded research-peptide marketing. The
   * molecules didn't change, so customers still search by the
   * old molecule name — we match on that silently and surface
   * the correct XM-* product.
   */
  searchAliases?: string[]
}

// Top-level category filter used by the homepage grid. Ordered by commercial
// importance: GLP-1 weight-loss first, then growth hormone and recovery which
// drive most of the catalog's volume, followed by the specialty shelves
// (sexual health, cognitive, sleep, performance, fertility, skin) that a
// returning customer typically browses for. "Research" is kept as a
// fallback bucket for new or uncategorized compounds, and "Accessories" is
// always last since it only holds support items (water, syringes).
export const categories = [
  "All",
  "GLP-1",
  "Growth Hormone",
  "Recovery",
  "Sexual Health",
  "Anti-Aging",
  "Cognitive",
  "Sleep",
  "Performance & Muscle",
  "Fertility & Hormonal",
  "Skin & Beauty",
  "Bundles",
  "Research",
  "Accessories",
]

/**
 * Helper for building standard peptide variant pairs: a single vial at
 * `vialPrice` plus a kit-of-ten at 9× the vial price — effectively a
 * "buy 9, get 1 free" bulk offer (10% off vs. 10 single vials).
 *
 * Kept as a helper so the peptide vials stay in sync: any future price
 * adjustment flows through one multiplier. Accessories and non-vial
 * bulk packs (bac-water 30ml, bac-water 3ml, starter-kit, syringes)
 * are intentionally priced by hand in the DB and do not use this
 * helper — their bulk discounts are tuned separately based on retail
 * realities for those SKUs.
 */
function sv(strength: string, vialPrice: number): Variant[] {
  return [
    { strength, form: "Single Vial", price: vialPrice },
    { strength, form: "Kit of 10 Vials", price: Math.round(vialPrice * 9) },
  ]
}

export const products: Product[] = [
  // ===== Metabolic research line =====
  //
  // The four entries below are the rebranded GLP-1 / metabolic-pathway
  // compounds (previously listed under the Tirzepatide / Semaglutide /
  // Retatrutide / Cagrilintide scientific names). We moved to neutral
  // XM-* codes in response to the FDA enforcement action on branded
  // research-peptide marketing — the molecules themselves are
  // unchanged. Each entry sets an explicit `slug` so URLs match the
  // DB (`xm-t`, `xm-s`, `xm-r`, `xm-c`) rather than the slugify
  // fallback "xm-t-dual-pathway", and the name-derived slug is
  // auto-aliased by `PRODUCTS_BY_SLUG` for graceful fallbacks. Old
  // slugs (tirzepatide/semaglutide/retatrutide/cagrilintide) are 301'd
  // to the new ones at the HTTP layer in next.config.mjs so historical
  // inbound links keep working.
  {
    id: 1,
    name: "XM-T (Dual Pathway)",
    slug: "xm-t",
    category: "GLP-1",
    description: "Dual-pathway metabolic research peptide for laboratory applications.",
    purity: "99.1%",
    inStock: true,
    popular: true,
    limitedStock: true,
    image: "/products/xm-t.jpg",
    searchAliases: ["tirzepatide"],
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
    name: "XM-S (GLP-1 Pathway)",
    slug: "xm-s",
    category: "GLP-1",
    description: "GLP-1 pathway research peptide for metabolic and appetite studies.",
    purity: "99.3%",
    inStock: true,
    popular: true,
    image: "/products/xm-s.jpg",
    variants: [...sv("2mg", 50), ...sv("5mg", 76), ...sv("10mg", 140)],
    searchAliases: ["semaglutide"],
  },
  {
    id: 3,
    name: "XM-R (Triple Pathway)",
    slug: "xm-r",
    category: "GLP-1",
    description: "Triple-pathway metabolic research peptide for laboratory applications.",
    purity: "99.2%",
    inStock: true,
    popular: true,
    limitedStock: true,
    image: "/products/xm-r.jpg",
    variants: [...sv("10mg", 180), ...sv("20mg", 260)],
    searchAliases: ["retatrutide"],
  },
  {
    id: 4,
    name: "XM-C (Amylin Support)",
    slug: "xm-c",
    category: "GLP-1",
    description: "Amylin pathway research peptide for appetite and metabolic studies.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/xm-c.jpg",
    variants: [...sv("5mg", 80), ...sv("10mg", 160)],
    searchAliases: ["cagrilintide"],
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
    variants: [...sv("2mg", 60), ...sv("5mg", 120)],
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
    variants: [...sv("2mg", 60), ...sv("5mg", 100)],
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
    variants: [...sv("2mg", 60), ...sv("5mg", 120), ...sv("10mg", 160)],
  },
  {
    id: 8,
    name: "CJC-1295 (with DAC)",
    slug: "cjc-1295-dac",
    category: "Growth Hormone",
    description: "Long-acting GHRH analog with drug affinity complex for sustained release.",
    purity: "99.1%",
    inStock: true,
    popular: true,
    image: "/products/cjc-1295-dac.jpg",
    variants: [...sv("2mg", 60)],
  },
  {
    id: 9,
    name: "CJC-1295 (no DAC)",
    slug: "cjc-1295",
    category: "Growth Hormone",
    description: "Short-acting GHRH analog without drug affinity complex.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/cjc-1295-no-dac.jpg",
    variants: [...sv("2mg", 40), ...sv("5mg", 60), ...sv("10mg", 100)],
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
    variants: [...sv("2mg", 30), ...sv("5mg", 40), ...sv("10mg", 70)],
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
    variants: [...sv("2mg", 40), ...sv("5mg", 80)],
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
    variants: [...sv("2mg", 24), ...sv("5mg", 36)],
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
    variants: [...sv("10 IU", 60)],
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
    variants: [...sv("0.1mg", 60), ...sv("1mg", 240)],
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
    variants: [...sv("5mg", 60)],
  },
  {
    id: 16,
    name: "MK-677 (Ibutamoren)",
    slug: "mk-677",
    category: "Growth Hormone",
    description: "Oral ghrelin receptor agonist for growth hormone research (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/mk-677.jpg",
    variants: [{ strength: "Tablets", form: "Bottle", price: 240 }],
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
    variants: [...sv("2mg", 30), ...sv("5mg", 50), ...sv("10mg", 90)],
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
    variants: [...sv("2mg", 50), ...sv("5mg", 70), ...sv("10mg", 120)],
  },
  {
    id: 19,
    name: "GHK-Cu",
    category: "Skin & Beauty",
    description: "Copper tripeptide for skin and tissue healing research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/ghk-cu.jpg",
    variants: [...sv("50mg", 50), ...sv("100mg", 80)],
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
    variants: [...sv("5mg", 100), ...sv("10mg", 160)],
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
    variants: [...sv("10mg", 60)],
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
    variants: [...sv("10mg", 80)],
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
    variants: [...sv("10mg", 80)],
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
    variants: [...sv("5mg", 50)],
  },
  {
    id: 25,
    name: "DSIP",
    category: "Sleep",
    description: "Delta sleep-inducing peptide for sleep cycle research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/dsip.jpg",
    variants: [...sv("5mg", 80)],
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
    variants: [...sv("16mg", 80)],
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
    variants: [...sv("10mg", 60)],
  },
  {
    id: 28,
    name: "NAD+",
    slug: "nad-plus",
    category: "Anti-Aging",
    description: "Nicotinamide adenine dinucleotide for mitochondrial research.",
    purity: "99.2%",
    inStock: true,
    popular: true,
    image: "/products/nad.jpg",
    variants: [...sv("500mg", 60)],
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
    variants: [{ strength: "Tablets", form: "Bottle", price: 120 }],
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
    variants: [...sv("10mg", 140)],
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
    variants: [...sv("10mg", 140)],
  },
  {
    id: 32,
    name: "Snap-8",
    category: "Skin & Beauty",
    description: "Octapeptide for skincare and neuromodulatory research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/snap-8.jpg",
    variants: [...sv("10mg", 60)],
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
    variants: [...sv("8mg", 60)],
  },

  // ===== Research =====
  {
    id: 34,
    name: "PT-141",
    category: "Sexual Health",
    description: "Melanocortin receptor agonist for sexual health research.",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/pt-141.jpg",
    variants: [...sv("5mg", 50), ...sv("10mg", 90)],
  },
  {
    id: 35,
    name: "Melanotan 2",
    category: "Skin & Beauty",
    description: "Synthetic analog of alpha-melanocyte-stimulating hormone.",
    purity: "98.7%",
    inStock: true,
    popular: false,
    image: "/products/melanotan-2.jpg",
    variants: [...sv("10mg", 50)],
  },
  {
    id: 36,
    name: "Oxytocin Acetate",
    slug: "oxytocin",
    category: "Sexual Health",
    description: "Nine-amino-acid peptide hormone for social behavior research.",
    purity: "99.1%",
    inStock: true,
    popular: false,
    image: "/products/oxytocin.jpg",
    variants: [...sv("2mg", 60)],
  },
  {
    id: 37,
    name: "Kisspeptin-10",
    category: "Fertility & Hormonal",
    description: "GPR54 agonist peptide for reproductive endocrinology research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/kisspeptin-10.jpg",
    variants: [...sv("5mg", 80)],
  },
  {
    id: 38,
    name: "HCG",
    category: "Fertility & Hormonal",
    description: "Human chorionic gonadotropin for endocrine research.",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/hcg.jpg",
    variants: [...sv("5000 IU", 80)],
  },
  {
    id: 39,
    name: "HMG",
    category: "Fertility & Hormonal",
    description: "Human menopausal gonadotropin for reproductive research.",
    purity: "98.8%",
    inStock: true,
    popular: false,
    image: "/products/hmg.jpg",
    variants: [...sv("75 IU", 60)],
  },
  {
    id: 40,
    name: "FST344",
    category: "Performance & Muscle",
    description: "Follistatin 344 for myostatin inhibition research.",
    purity: "98.7%",
    inStock: true,
    popular: false,
    image: "/products/fst344.jpg",
    variants: [...sv("1mg", 180)],
  },
  {
    id: 41,
    name: "GDF-8 (Myostatin)",
    slug: "gdf-8",
    category: "Performance & Muscle",
    description: "Growth differentiation factor 8 for muscle biology research.",
    purity: "98.9%",
    inStock: true,
    popular: false,
    image: "/products/gdf-8.jpg",
    variants: [...sv("1mg", 160)],
  },
  {
    id: 42,
    name: "GW501516 (Cardarine)",
    slug: "gw501516",
    category: "Performance & Muscle",
    description: "PPAR-delta agonist research compound (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/gw501516.jpg",
    variants: [{ strength: "Tablets", form: "Bottle", price: 160 }],
  },
  {
    id: 43,
    name: "SLU-PP-332",
    category: "Performance & Muscle",
    description: "ERR agonist research compound (tablets).",
    purity: "99.0%",
    inStock: true,
    popular: false,
    image: "/products/slu-pp-332.jpg",
    variants: [{ strength: "Tablets", form: "Bottle", price: 160 }],
  },
  {
    id: 44,
    name: "GLOW Blend",
    category: "Skin & Beauty",
    description: "Blend of BPC-157 / TB-500 / GHK-Cu for tissue research.",
    purity: "99.0%",
    inStock: true,
    popular: true,
    image: "/products/glow-blend.jpg",
    variants: [...sv("10/10/75mg", 240)],
  },

  // ===== Accessories =====
  {
    id: 45,
    name: "Starter Kit",
    category: "Bundles",
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
    slug: "bac-water",
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
    description:
      "1/2ml — 31G × 8mm. Sterile insulin syringes for precise peptide administration. 100 count per pack.",
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

/**
 * Canonicalize a product name into a URL slug. Must be stable and match the
 * `slug` column on public.products so that admin-inserted embed tokens like
 * `[[product:aod-9604]]` resolve to this exact slug.
 *
 * Rules: lowercase, runs of non-alphanumerics → single dash, trim leading
 * and trailing dashes. Examples:
 *   "AOD-9604"                   → "aod-9604"
 *   "CJC-1295 (with DAC)"        → "cjc-1295-with-dac"
 *   "Thymosin Beta-4 (TB-500)"   → "thymosin-beta-4-tb-500"
 *   "Bacteriostatic Water 30ml"  → "bacteriostatic-water-30ml"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Keep slug→product lookups O(1) across the site (we hit this on every
 * detail page render and on every embed expansion).
 *
 * Each product contributes its canonical slug (explicit `slug` field when
 * present, otherwise the name-derived one). For products that set both,
 * we also register the name-derived variant as an alias so stale links
 * floating around from before the override was added still resolve.
 */
const PRODUCTS_BY_SLUG: ReadonlyMap<string, Product> = (() => {
  const map = new Map<string, Product>()
  for (const p of products) {
    const canonical = (p.slug ?? slugify(p.name)).toLowerCase()
    map.set(canonical, p)
    const fromName = slugify(p.name).toLowerCase()
    if (fromName && fromName !== canonical && !map.has(fromName)) {
      map.set(fromName, p)
    }
  }
  return map
})()

export function getProductBySlug(slug: string): Product | undefined {
  if (!slug) return undefined
  return PRODUCTS_BY_SLUG.get(slug.toLowerCase())
}

export function productSlug(product: Pick<Product, "name" | "slug">): string {
  return (product.slug ?? slugify(product.name)).toLowerCase()
}

/**
 * Used by Next.js `generateStaticParams` to pre-render every detail page.
 * Only the canonical slug per product is returned — alias entries are
 * intentionally omitted so we don't generate duplicate pages with the
 * same content (bad for SEO).
 */
export function getAllProductSlugs(): string[] {
  return products.map((p) => (p.slug ?? slugify(p.name)).toLowerCase())
}

/**
 * Utilities used by the homepage grid (variants have both a strength and a
 * form; the UI lets the user pick each independently).
 */
export function getUniqueStrengths(variants: Variant[]): string[] {
  return Array.from(new Set(variants.map((v) => v.strength)))
}
export function getFormsForStrength(variants: Variant[], strength: string): string[] {
  return Array.from(
    new Set(variants.filter((v) => v.strength === strength).map((v) => v.form)),
  )
}
