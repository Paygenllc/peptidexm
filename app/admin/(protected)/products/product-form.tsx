"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Loader2 } from "lucide-react"
import type { Product, ProductVariant } from "@/lib/types"
import { saveProductAction, deleteProductAction } from "@/app/admin/actions/products"

type VariantInput = {
  id?: string
  variant_name: string
  price: string
  stock: string
  sku: string
}

export function ProductForm({ product, variants }: { product?: Product; variants?: ProductVariant[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    slug: product?.slug ?? "",
    name: product?.name ?? "",
    category: product?.category ?? "",
    description: product?.description ?? "",
    purity: product?.purity ?? "",
    dosage: product?.dosage ?? "",
    image_url: product?.image_url ?? "",
    active: product?.active ?? true,
    featured: product?.featured ?? false,
    sort_order: product?.sort_order?.toString() ?? "0",
  })

  const [variantList, setVariantList] = useState<VariantInput[]>(
    variants && variants.length > 0
      ? variants.map((v) => ({
          id: v.id,
          variant_name: v.variant_name,
          price: v.price.toString(),
          stock: v.stock.toString(),
          sku: v.sku ?? "",
        }))
      : [{ variant_name: "Single Vial", price: "", stock: "999", sku: "" }],
  )

  function updateVariant(index: number, field: keyof VariantInput, value: string) {
    setVariantList((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)))
  }

  function addVariant() {
    setVariantList((prev) => [...prev, { variant_name: "", price: "", stock: "999", sku: "" }])
  }

  function removeVariant(index: number) {
    setVariantList((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await saveProductAction({
        id: product?.id,
        ...form,
        sort_order: Number.parseInt(form.sort_order) || 0,
        variants: variantList.map((v, idx) => ({
          id: v.id,
          variant_name: v.variant_name,
          price: Number.parseFloat(v.price) || 0,
          stock: Number.parseInt(v.stock) || 0,
          sku: v.sku || null,
          sort_order: idx,
        })),
      })
      if (result.error) {
        setError(result.error)
      } else if (result.id && !product) {
        router.push(`/admin/products/${result.id}`)
      } else {
        setMessage("Product saved successfully")
        router.refresh()
      }
    })
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete ${product.name}? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteProductAction(product.id)
      if (result.error) setError(result.error)
      else router.push("/admin/products")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Basic Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="unique-product-slug"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="GLP-1, Recovery, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purity">Purity</Label>
            <Input
              id="purity"
              value={form.purity}
              onChange={(e) => setForm({ ...form, purity: e.target.value })}
              placeholder="99.1%"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
              placeholder="10mg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image_url">Image URL</Label>
            <Input
              id="image_url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="/products/example.jpg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="active" checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
            <Label htmlFor="active">Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="featured"
              checked={form.featured}
              onCheckedChange={(c) => setForm({ ...form, featured: c })}
            />
            <Label htmlFor="featured">Featured</Label>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Variants</h2>
          <Button type="button" variant="outline" size="sm" onClick={addVariant}>
            <Plus className="w-4 h-4 mr-1" />
            Add variant
          </Button>
        </div>
        <div className="space-y-3">
          {variantList.map((v, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                {idx === 0 && <Label className="text-xs text-muted-foreground">Name</Label>}
                <Input
                  required
                  value={v.variant_name}
                  onChange={(e) => updateVariant(idx, "variant_name", e.target.value)}
                  placeholder="Single Vial"
                />
              </div>
              <div className="space-y-1">
                {idx === 0 && <Label className="text-xs text-muted-foreground">Price ($)</Label>}
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={v.price}
                  onChange={(e) => updateVariant(idx, "price", e.target.value)}
                  placeholder="189.99"
                />
              </div>
              <div className="space-y-1">
                {idx === 0 && <Label className="text-xs text-muted-foreground">Stock</Label>}
                <Input
                  type="number"
                  value={v.stock}
                  onChange={(e) => updateVariant(idx, "stock", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                {idx === 0 && <Label className="text-xs text-muted-foreground">SKU</Label>}
                <Input
                  value={v.sku}
                  onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeVariant(idx)}
                disabled={variantList.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      <div className="flex items-center justify-between gap-3">
        {product && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            Delete product
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save product"}
          </Button>
        </div>
      </div>
    </form>
  )
}
