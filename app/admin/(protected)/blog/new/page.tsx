import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BlogPostEditor } from "../blog-post-editor"

export const dynamic = "force-dynamic"

export default function NewBlogPostPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to blog
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">New blog post</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compose in Markdown. You can save as a draft and publish later.
        </p>
      </div>

      <BlogPostEditor mode="create" />
    </div>
  )
}
