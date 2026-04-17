import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { ProductForm } from "../product-form"

export const dynamic = "force-dynamic"

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase.from("products").select("*").eq("id", id).single()
  if (!product) notFound()

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", id)
    .order("sort_order", { ascending: true })

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to products
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
        <p className="text-muted-foreground mt-1">Edit product details and variants</p>
      </div>

      <ProductForm product={product} variants={variants ?? []} />
    </div>
  )
}
