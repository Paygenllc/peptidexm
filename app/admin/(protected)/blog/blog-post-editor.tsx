"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createBlogPostAction,
  updateBlogPostAction,
  deleteBlogPostAction,
} from "@/app/admin/actions/blog"
import { Loader2, Save, Trash2, Eye, Pencil } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type EditorInitial = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content_markdown: string
  cover_image_url: string | null
  tags: string[]
  status: string
}

export function BlogPostEditor({
  mode,
  initial,
}: {
  mode: "create" | "edit"
  initial?: EditorInitial
}) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [slug, setSlug] = useState(initial?.slug ?? "")
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "")
  const [content, setContent] = useState(initial?.content_markdown ?? "")
  const [coverImage, setCoverImage] = useState(initial?.cover_image_url ?? "")
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "))
  const [status, setStatus] = useState(initial?.status ?? "draft")
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave(formData: FormData) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createBlogPostAction(formData)
          : await updateBlogPostAction(formData)
      if (result?.error) setError(result.error)
      else if (result?.success) setMessage("Saved")
    })
  }

  async function handleDelete() {
    if (!initial) return
    if (!confirm("Delete this post? This cannot be undone.")) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("id", initial.id)
      const res = await deleteBlogPostAction(fd)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <form action={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="lg:col-span-2 space-y-5">
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Give your post a clear, specific title"
              maxLength={160}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              name="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="Short summary shown on the blog index and in link previews"
              maxLength={240}
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Content</Label>
            <div className="flex rounded-md border border-border p-0.5 bg-secondary/40">
              <button
                type="button"
                onClick={() => setTab("write")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  tab === "write" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Pencil className="w-3 h-3" /> Write
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  tab === "preview" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            </div>
          </div>

          {tab === "write" ? (
            <>
              <Textarea
                id="content"
                name="content_markdown"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={22}
                placeholder={`# Your heading\n\nWrite your post in Markdown.\n\n- Bullet lists\n- Links like [this](https://peptidexm.com)\n- **Bold** and _italic_`}
                className="font-mono text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Supports Markdown, GitHub-flavored tables, and inline links.
              </p>
            </>
          ) : (
            <article className="rounded-md border border-border bg-background p-5 min-h-[420px] prose prose-sm md:prose-base max-w-none prose-headings:font-serif prose-headings:font-medium prose-a:text-primary">
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">Nothing to preview yet.</p>
              )}
            </article>
          )}
        </Card>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-foreground rounded-md bg-green-50 border border-green-200 px-3 py-2">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === "create" ? "Create post" : "Save changes"}
          </Button>
          {mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={isPending}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <aside className="space-y-5">
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Visibility</Label>
            <Select name="status" value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft — not visible to the public</SelectItem>
                <SelectItem value="published">Published — live on the blog</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="leave blank to auto-generate from title"
              pattern="[a-z0-9-]*"
            />
            <p className="text-xs text-muted-foreground">
              URL:{" "}
              <span className="font-mono text-[11px]">
                /blog/{slug || "auto-from-title"}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              name="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="research, news, how-to"
            />
            <p className="text-xs text-muted-foreground">Comma-separated. Up to 10.</p>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cover_image_url">Cover image URL</Label>
            <Input
              id="cover_image_url"
              name="cover_image_url"
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
            />
          </div>
          {coverImage && (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border bg-secondary">
              {/* Unoptimized because it could be any origin; next/image would require domain config. */}
              <Image
                src={coverImage}
                alt="Cover preview"
                fill
                unoptimized
                sizes="320px"
                className="object-cover"
              />
            </div>
          )}
        </Card>
      </aside>
    </form>
  )
}
