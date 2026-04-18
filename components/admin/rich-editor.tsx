"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { createClient as createBrowserSupabase } from "@/lib/supabase/client"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image as ImageIcon,
  Smile,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Loader2,
} from "lucide-react"

// emoji-picker-react ships a big JS bundle. Only load it when the admin opens
// the emoji popover to keep the editor's initial payload small.
const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] w-[320px] items-center justify-center rounded-md border border-border bg-background text-xs text-muted-foreground">
      Loading emoji…
    </div>
  ),
})

/**
 * Rich-text editor used by the admin blog CMS. Produces sanitized HTML (stored
 * as-is in `blog_posts.content_markdown`, which at this point simply holds the
 * post body regardless of format — the public renderer detects HTML vs legacy
 * markdown). Supports:
 *
 * - Formatting: bold / italic / underline / strike, H1–H3
 * - Blocks: bullet + ordered lists, blockquote, code block, horizontal rule
 * - Alignment: left / center / right
 * - Links (with scheme-restricted prompt)
 * - Emoji (via emoji-picker-react in a popover)
 * - Images: toolbar upload button, paste from clipboard, drag-and-drop
 *   → files are uploaded directly to the public `blog-images` bucket using the
 *   signed-in admin's JWT (storage RLS restricts writes to admins), and the
 *   returned public URL is inserted as an <img>. 10 MB max per file.
 * - Undo / redo (bundled StarterKit history)
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 420,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track the latest onChange in a ref so the editor extensions don't need to
  // be recreated every time the parent rerenders.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("That file isn't an image.")
      return null
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be under 10 MB.")
      return null
    }
    setUploadError(null)
    setUploading(true)
    try {
      const supabase = createBrowserSupabase()
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "")
      const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from("blog-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from("blog-images").getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      console.error("[v0] blog image upload failed", err)
      setUploadError("Upload failed. Try again.")
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Bundled history lets us provide Undo/Redo buttons without a separate install.
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
          class: "text-primary underline underline-offset-2",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg my-4" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing…",
      }),
    ],
    content: value,
    // Required for Next.js SSR to avoid hydration mismatches.
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChangeRef.current(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm md:prose-base max-w-none focus:outline-none px-4 py-4 " +
          "prose-headings:font-serif prose-headings:font-medium " +
          "prose-a:text-primary prose-img:rounded-lg prose-img:my-4 " +
          "prose-blockquote:border-l-accent prose-blockquote:italic " +
          "prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none " +
          "prose-pre:bg-secondary prose-pre:text-foreground",
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (!file) continue
            event.preventDefault()
            handleImageFile(file).then((url) => {
              if (url) {
                editor?.chain().focus().setImage({ src: url, alt: "" }).run()
              }
            })
            return true
          }
        }
        return false
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files
        if (!files?.length) return false
        const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"))
        if (!imageFile) return false
        event.preventDefault()
        handleImageFile(imageFile).then((url) => {
          if (url) {
            editor?.chain().focus().setImage({ src: url, alt: "" }).run()
          }
        })
        return true
      },
    },
  })

  // Keep the editor in sync with external value changes (e.g. form reset, prop
  // updates). Only push in when genuinely different to avoid cursor jumps
  // while the admin is typing.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value && !editor.isFocused) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  const pickImage = () => fileInputRef.current?.click()

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes("link").href
    const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://")
    if (url === null) return
    const trimmed = url.trim()
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    // Whitelist safe schemes to prevent javascript:/data: XSS.
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      window.alert("Links must start with http://, https://, or mailto:")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run()
  }

  const insertEmoji = (emoji: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(emoji).run()
  }

  if (!editor) {
    return (
      <div
        className="rounded-md border border-border bg-background"
        style={{ minHeight: minHeight + 56 }}
        aria-busy="true"
      />
    )
  }

  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 p-1.5 sticky top-0 z-10">
        <TbGroup>
          <TbBtn
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </TbBtn>
        </TbGroup>
        <TbSep />
        <TbGroup>
          <TbBtn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </TbBtn>
        </TbGroup>
        <TbSep />
        <TbGroup>
          <TbBtn
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          >
            <Code className="w-4 h-4" />
          </TbBtn>
        </TbGroup>
        <TbSep />
        <TbGroup>
          <TbBtn
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align left"
          >
            <AlignLeft className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Align center"
          >
            <AlignCenter className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="Align right"
          >
            <AlignRight className="w-4 h-4" />
          </TbBtn>
        </TbGroup>
        <TbSep />
        <TbGroup>
          <TbBtn onClick={setLink} active={editor.isActive("link")} title="Link">
            <Link2 className="w-4 h-4" />
          </TbBtn>
          <TbBtn onClick={pickImage} disabled={uploading} title="Insert image">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </TbBtn>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                title="Emoji"
                aria-label="Insert emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 border-none bg-transparent shadow-none w-auto" align="start">
              <EmojiPicker
                onEmojiClick={(e) => insertEmoji(e.emoji)}
                width={320}
                height={380}
                searchPlaceholder="Search emoji"
                skinTonesDisabled
              />
            </PopoverContent>
          </Popover>
          <TbBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            <Minus className="w-4 h-4" />
          </TbBtn>
        </TbGroup>
        <TbSep />
        <TbGroup>
          <TbBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </TbBtn>
        </TbGroup>
      </div>

      <div style={{ minHeight }} className="relative">
        <EditorContent editor={editor} />
        {uploading && (
          <div className="absolute inset-x-0 top-0 bg-accent/10 text-accent-foreground text-xs text-center py-1.5">
            <Loader2 className="w-3 h-3 animate-spin inline-block mr-1.5 align-[-2px]" />
            Uploading image…
          </div>
        )}
      </div>

      {uploadError && (
        <div
          role="alert"
          className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive"
        >
          {uploadError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleImageFile(file).then((url) => {
              if (url) {
                editor?.chain().focus().setImage({ src: url, alt: "" }).run()
              }
            })
          }
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
      />
    </div>
  )
}

function TbGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}
function TbSep() {
  return <Separator orientation="vertical" className="h-5 mx-1" />
}
function TbBtn({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-8 w-8 rounded-md inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
