import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ProductForm } from "../product-form"

export default function NewProductPage() {
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
        <h1 className="text-3xl font-bold text-foreground">New Product</h1>
        <p className="text-muted-foreground mt-1">Create a new product with variants</p>
      </div>

      <ProductForm />
    </div>
  )
}
