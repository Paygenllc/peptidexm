"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Plus, Check } from "lucide-react"

const categories = ["All", "GLP-1", "Growth Hormone", "Recovery", "Cognitive", "Anti-Aging", "Research", "Accessories"]

const products = [
  // GLP-1 Category
  {
    id: 1,
    name: "Tirzepatide",
    category: "GLP-1",
    description: "Dual GIP and GLP-1 receptor agonist for metabolic research applications.",
    price: 189.99,
    purity: "99.1%",
    dosage: "10mg",
    inStock: true,
    popular: true,
    image: "/products/tirzepatide.jpg",
  },
  {
    id: 2,
    name: "Semaglutide",
    category: "GLP-1",
    description: "GLP-1 receptor agonist peptide for metabolic and appetite research.",
    price: 159.99,
    purity: "99.3%",
    dosage: "5mg",
    inStock: true,
    popular: true,
    image: "/products/semaglutide.jpg",
  },
  {
    id: 3,
    name: "Retatrutide",
    category: "GLP-1",
    description: "Triple agonist peptide targeting GLP-1, GIP, and glucagon receptors.",
    price: 219.99,
    purity: "99.1%",
    dosage: "10mg",
    inStock: true,
    popular: true,
    image: "/products/retatrutide.jpg",
  },
  {
    id: 4,
    name: "Cagrilintide",
    category: "GLP-1",
    description: "Long-acting amylin analog for metabolic and satiety research.",
    price: 179.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/cagrilintide.jpg",
  },
  {
    id: 5,
    name: "AOD-9604",
    category: "GLP-1",
    description: "Modified fragment of HGH for lipolysis and metabolic research.",
    price: 89.99,
    purity: "99.2%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/aod-9604.jpg",
  },
  // Growth Hormone Category
  {
    id: 6,
    name: "Sermorelin",
    category: "Growth Hormone",
    description: "Growth hormone releasing hormone analog for GHRH receptor studies.",
    price: 79.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: true,
    image: "/products/sermorelin.jpg",
  },
  {
    id: 7,
    name: "Tesamorelin",
    category: "Growth Hormone",
    description: "Growth hormone releasing factor analog for body composition research.",
    price: 134.99,
    purity: "99.2%",
    dosage: "5mg",
    inStock: true,
    popular: true,
    image: "/products/tesamorelin.jpg",
  },
  {
    id: 8,
    name: "CJC-1295 (with DAC)",
    category: "Growth Hormone",
    description: "Modified GHRH with Drug Affinity Complex for extended half-life studies.",
    price: 89.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/cjc-1295-dac.jpg",
  },
  {
    id: 9,
    name: "CJC-1295 (no DAC)",
    category: "Growth Hormone",
    description: "Modified GHRH without DAC for pulsatile GH release research.",
    price: 79.99,
    purity: "99.1%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/cjc-1295.jpg",
  },
  {
    id: 10,
    name: "Ipamorelin",
    category: "Growth Hormone",
    description: "Selective growth hormone secretagogue for GH pulse research.",
    price: 69.99,
    purity: "99.1%",
    dosage: "5mg",
    inStock: true,
    popular: true,
    image: "/products/ipamorelin.jpg",
  },
  {
    id: 11,
    name: "Hexarelin",
    category: "Growth Hormone",
    description: "Potent hexapeptide GHRP for growth hormone secretion studies.",
    price: 74.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/hexarelin.jpg",
  },
  {
    id: 12,
    name: "GHRP-2",
    category: "Growth Hormone",
    description: "Growth hormone releasing peptide-2 for GH secretion research.",
    price: 64.99,
    purity: "99.2%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/ghrp-2.jpg",
  },
  {
    id: 13,
    name: "HGH",
    category: "Growth Hormone",
    description: "Human growth hormone for comprehensive GH research applications.",
    price: 299.99,
    purity: "99.5%",
    dosage: "10IU",
    inStock: true,
    popular: true,
    image: "/products/hgh.jpg",
  },
  {
    id: 14,
    name: "IGF-1 LR3",
    category: "Growth Hormone",
    description: "Long-acting insulin-like growth factor for muscle research.",
    price: 149.99,
    purity: "99.1%",
    dosage: "1mg",
    inStock: true,
    popular: false,
    image: "/products/igf-1-lr3.jpg",
  },
  {
    id: 15,
    name: "PEG MGF",
    category: "Growth Hormone",
    description: "PEGylated mechano growth factor for tissue repair research.",
    price: 119.99,
    purity: "99.0%",
    dosage: "2mg",
    inStock: true,
    popular: false,
    image: "/products/peg-mgf.jpg",
  },
  {
    id: 16,
    name: "MK-677 (Ibutamoren)",
    category: "Growth Hormone",
    description: "Non-peptide ghrelin mimetic for oral GH secretagogue research.",
    price: 79.99,
    purity: "99.3%",
    dosage: "25mg/mL",
    inStock: true,
    popular: true,
    image: "/products/mk-677.jpg",
  },
  // Recovery Category
  {
    id: 17,
    name: "BPC-157",
    category: "Recovery",
    description: "Body protection compound for tissue healing and repair research.",
    price: 54.99,
    purity: "99.2%",
    dosage: "5mg",
    inStock: true,
    popular: true,
    image: "/products/bpc-157.jpg",
  },
  {
    id: 18,
    name: "Thymosin B4 (TB-500)",
    category: "Recovery",
    description: "Thymosin beta-4 for cell migration and tissue repair research.",
    price: 74.99,
    purity: "99.1%",
    dosage: "5mg",
    inStock: true,
    popular: true,
    image: "/products/tb-500.jpg",
  },
  {
    id: 19,
    name: "GHK-Cu",
    category: "Recovery",
    description: "Copper peptide complex for skin regeneration and wound healing research.",
    price: 64.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/ghk-cu.jpg",
  },
  {
    id: 20,
    name: "Thymosin Alpha 1",
    category: "Recovery",
    description: "Immune-modulating peptide for immunology research applications.",
    price: 89.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/thymosin-alpha-1.jpg",
  },
  {
    id: 21,
    name: "KPV",
    category: "Recovery",
    description: "Anti-inflammatory tripeptide for inflammation and healing research.",
    price: 59.99,
    purity: "99.1%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/kpv.jpg",
  },
  {
    id: 22,
    name: "Thymulin",
    category: "Recovery",
    description: "Zinc-dependent thymic peptide for immune function research.",
    price: 69.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/thymulin.jpg",
  },
  // Cognitive Category
  {
    id: 23,
    name: "Semax",
    category: "Cognitive",
    description: "Nootropic heptapeptide for cognitive enhancement research.",
    price: 49.99,
    purity: "99.2%",
    dosage: "30mg",
    inStock: true,
    popular: true,
    image: "/products/semax.jpg",
  },
  {
    id: 24,
    name: "Selank",
    category: "Cognitive",
    description: "Anxiolytic peptide for stress and cognition research.",
    price: 49.99,
    purity: "99.1%",
    dosage: "30mg",
    inStock: true,
    popular: true,
    image: "/products/selank.jpg",
  },
  {
    id: 25,
    name: "DSIP",
    category: "Cognitive",
    description: "Delta sleep-inducing peptide for sleep cycle research.",
    price: 59.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/dsip.jpg",
  },
  {
    id: 26,
    name: "Pinealon",
    category: "Cognitive",
    description: "Bioregulator peptide for brain and nervous system research.",
    price: 54.99,
    purity: "99.0%",
    dosage: "20mg",
    inStock: true,
    popular: false,
    image: "/products/pinealon.jpg",
  },
  // Anti-Aging Category
  {
    id: 27,
    name: "Epithalon",
    category: "Anti-Aging",
    description: "Tetrapeptide for telomerase activation and longevity research.",
    price: 89.99,
    purity: "99.1%",
    dosage: "10mg",
    inStock: true,
    popular: true,
    image: "/products/epithalon.jpg",
  },
  {
    id: 28,
    name: "NAD+",
    category: "Anti-Aging",
    description: "Nicotinamide adenine dinucleotide for cellular energy research.",
    price: 129.99,
    purity: "99.5%",
    dosage: "500mg",
    inStock: true,
    popular: true,
    image: "/products/nad-plus.jpg",
  },
  {
    id: 29,
    name: "NMN",
    category: "Anti-Aging",
    description: "Nicotinamide mononucleotide for NAD+ precursor research.",
    price: 99.99,
    purity: "99.3%",
    dosage: "500mg",
    inStock: true,
    popular: true,
    image: "/products/nmn.jpg",
  },
  {
    id: 30,
    name: "MOTS-C",
    category: "Anti-Aging",
    description: "Mitochondrial-derived peptide for metabolic and aging research.",
    price: 119.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/mots-c.jpg",
  },
  {
    id: 31,
    name: "SS31",
    category: "Anti-Aging",
    description: "Mitochondria-targeted antioxidant peptide for cellular research.",
    price: 109.99,
    purity: "99.1%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/ss31.jpg",
  },
  {
    id: 32,
    name: "Snap-8",
    category: "Anti-Aging",
    description: "Octapeptide for wrinkle reduction and cosmetic research.",
    price: 69.99,
    purity: "99.0%",
    dosage: "500mg",
    inStock: true,
    popular: false,
    image: "/products/snap-8.jpg",
  },
  {
    id: 33,
    name: "PE 22-28",
    category: "Anti-Aging",
    description: "Spadin analog peptide for neuroplasticity and mood research.",
    price: 79.99,
    purity: "99.0%",
    dosage: "10mg",
    inStock: true,
    popular: false,
    image: "/products/pe-22-28.jpg",
  },
  // Research Category
  {
    id: 34,
    name: "PT-141",
    category: "Research",
    description: "Melanocortin receptor agonist for sexual function research.",
    price: 64.99,
    purity: "99.2%",
    dosage: "10mg",
    inStock: true,
    popular: true,
    image: "/products/pt-141.jpg",
  },
  {
    id: 35,
    name: "Melanotan 2",
    category: "Research",
    description: "Synthetic melanocortin peptide for tanning and libido research.",
    price: 54.99,
    purity: "99.1%",
    dosage: "10mg",
    inStock: true,
    popular: true,
    image: "/products/melanotan-2.jpg",
  },
  {
    id: 36,
    name: "Oxytocin Acetate",
    category: "Research",
    description: "Neuropeptide hormone for social bonding and behavior research.",
    price: 79.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/oxytocin.jpg",
  },
  {
    id: 37,
    name: "Kisspeptin-10",
    category: "Research",
    description: "Hypothalamic peptide for reproductive endocrinology research.",
    price: 89.99,
    purity: "99.0%",
    dosage: "5mg",
    inStock: true,
    popular: false,
    image: "/products/kisspeptin-10.jpg",
  },
  {
    id: 38,
    name: "HCG",
    category: "Research",
    description: "Human chorionic gonadotropin for fertility research applications.",
    price: 99.99,
    purity: "99.3%",
    dosage: "5000IU",
    inStock: true,
    popular: false,
    image: "/products/hcg.jpg",
  },
  {
    id: 39,
    name: "HMG",
    category: "Research",
    description: "Human menopausal gonadotropin for gonadotropin research.",
    price: 109.99,
    purity: "99.0%",
    dosage: "75IU",
    inStock: true,
    popular: false,
    image: "/products/hmg.jpg",
  },
  {
    id: 40,
    name: "FST344",
    category: "Research",
    description: "Follistatin 344 for myostatin inhibition research applications.",
    price: 199.99,
    purity: "99.0%",
    dosage: "1mg",
    inStock: true,
    popular: false,
    image: "/products/fst344.jpg",
  },
  {
    id: 41,
    name: "GDF-8 (Myostatin)",
    category: "Research",
    description: "Growth differentiation factor for muscle regulation research.",
    price: 179.99,
    purity: "99.0%",
    dosage: "1mg",
    inStock: true,
    popular: false,
    image: "/products/gdf-8.jpg",
  },
  {
    id: 42,
    name: "GW501516 (Cardarine)",
    category: "Research",
    description: "PPAR-delta agonist for endurance and metabolic research.",
    price: 69.99,
    purity: "99.2%",
    dosage: "20mg/mL",
    inStock: true,
    popular: false,
    image: "/products/gw501516.jpg",
  },
  {
    id: 43,
    name: "SLU-PP-332",
    category: "Research",
    description: "ERR agonist for exercise mimetic and metabolic research.",
    price: 89.99,
    purity: "99.0%",
    dosage: "10mg",
    inStock: true,
    popular: false,
    image: "/products/slu-pp-332.jpg",
  },
  {
    id: 44,
    name: "GLOW Blend",
    category: "Research",
    description: "Custom peptide blend for skin and aesthetic research.",
    price: 129.99,
    purity: "99.0%",
    dosage: "10mg",
    inStock: true,
    popular: false,
    image: "/products/glow-blend.jpg",
  },
  {
    id: 45,
    name: "Starter Bundle",
    category: "Research",
    description: "Curated peptide bundle for new researchers getting started.",
    price: 249.99,
    purity: "99.0%",
    dosage: "Various",
    inStock: true,
    popular: true,
    image: "/products/starter-bundle.jpg",
  },
  // Accessories Category
  {
    id: 46,
    name: "Bacteriostatic Water",
    category: "Accessories",
    description: "Sterile water with 0.9% benzyl alcohol for peptide reconstitution.",
    price: 14.99,
    purity: "USP",
    dosage: "30mL",
    inStock: true,
    popular: true,
    image: "/products/bac-water.jpg",
  },
  {
    id: 47,
    name: "Insulin Syringes",
    category: "Accessories",
    description: "Sterile insulin syringes for precise peptide administration.",
    price: 19.99,
    purity: "Sterile",
    dosage: "100ct",
    inStock: true,
    popular: true,
    image: "/products/insulin-syringes.jpg",
  },
]

export function Products() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [addedToCart, setAddedToCart] = useState<number[]>([])

  const filteredProducts = selectedCategory === "All" 
    ? products 
    : products.filter(p => p.category === selectedCategory)

  const handleAddToCart = (id: number) => {
    setAddedToCart(prev => [...prev, id])
    setTimeout(() => {
      setAddedToCart(prev => prev.filter(i => i !== id))
    }, 2000)
  }

  return (
    <section id="products" className="py-24 lg:py-32 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
            Our Collection
          </p>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight text-foreground">
            Premium Research Peptides
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            All compounds undergo rigorous third-party testing to ensure the highest quality for your research needs.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="rounded-full"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id} 
              className="group overflow-hidden border-border/50 hover:border-border hover:shadow-lg transition-all duration-300"
            >
              <CardContent className="p-0">
                {/* Product Image Area */}
                <div className="relative aspect-square bg-secondary/50 flex items-center justify-center overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.popular && (
                    <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">
                      Popular
                    </Badge>
                  )}
                  {!product.inStock && (
                    <Badge variant="secondary" className="absolute top-3 right-3">
                      Out of Stock
                    </Badge>
                  )}
                </div>

                {/* Product Details */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-lg text-foreground group-hover:text-accent transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{product.dosage}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {product.purity}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl text-foreground">
                      ${product.price}
                    </span>
                    <Button 
                      size="sm" 
                      disabled={!product.inStock || addedToCart.includes(product.id)}
                      onClick={() => handleAddToCart(product.id)}
                      className="gap-2"
                    >
                      {addedToCart.includes(product.id) ? (
                        <>
                          <Check className="h-4 w-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
