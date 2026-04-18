"use client"

import { useState, useTransition, useRef } from "react"
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
import { Loader2, Save, Trash2, Eye, Pencil, Upload } from "lucide-react"
import { RichEditor } from "@/components/admin/rich-editor"
import { PostContent } from "@/components/post-content"
import { createClient as createBrowserSupabase } from "@/lib/supabase/client"

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
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  function handleSave(formData: FormData) {
    // React form handlers don't pick up controlled rich-editor state, so
    // overwrite the submitted fields with the latest values from our React
    // state before forwarding to the server action.
    formData.set("title", title)
    formData.set("slug", slug)
    formData.set("excerpt", excerpt)
    formData.set("content_markdown", content)
    formData.set("cover_image_url", coverImage)
    formData.set("tags", tags)
    formData.set("status", status)

    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createBlogPostAction(formData)
          : await updateBlogPostAction(formData)
      if ("error" in result && result.error) setError(result.error)
      else if ("success" in result && result.success) setMessage("Saved")
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

  async function handleCoverUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Cover file must be an image.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Cover image must be under 10 MB.")
      return
    }
    setError(null)
    setCoverUploading(true)
    try {
      const supabase = createBrowserSupabase()
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "")
      const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from("blog-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("blog-images").getPublicUrl(path)
      setCoverImage(data.publicUrl)
    } catch (err) {
      console.error("[v0] cover upload failed", err)
      setError("Cover upload failed. Please try again.")
    } finally {
      setCoverUploading(false)
    }
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

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
            <Label htmlFor="content" className="m-0">
              Content
            </Label>
            <div className="flex rounded-md border border-border p-0.5 bg-background">
              <button
                type="button"
                onClick={() => setTab("write")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  tab === "write" ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                <Pencil className="w-3 h-3" /> Write
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  tab === "preview" ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            </div>
          </div>

          {tab === "write" ? (
            <div className="p-0">
              <RichEditor
                value={content}
                onChange={setContent}
                placeholder="Write your post. Drag an image in, paste a screenshot, or use the toolbar."
                minHeight={480}
              />
              <p className="px-5 pt-2 pb-4 text-xs text-muted-foreground">
                Tip: drag-and-drop, paste screenshots, or click the image icon in the toolbar to
                upload. Emoji picker is in the toolbar. Undo / redo with ⌘Z / ⇧⌘Z.
              </p>
            </div>
          ) : (
            <article className="bg-background p-5 min-h-[480px]">
              {content.trim() ? (
                <PostContent content={content} />
              ) : (
                <p className="text-muted-foreground italic">Nothing to preview yet.</p>
              )}
            </article>
          )}
        </Card>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2"
          >
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
          <div className="flex items-center justify-between">
            <Label htmlFor="cover_image_url">Cover image</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
            >
              {coverUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Upload
            </Button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCoverUpload(file)
                if (coverInputRef.current) coverInputRef.current.value = ""
              }}
            />
          </div>
          <Input
            id="cover_image_url"
            name="cover_image_url"
            type="url"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://... or click Upload"
          />
          {coverImage && (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border bg-secondary">
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
