import DOMPurify from "isomorphic-dompurify"
import { ProseMarkdown } from "./prose-markdown"

/**
 * Renders a blog post body safely. The same `content_markdown` column now
 * holds content in two possible formats:
 *   - HTML produced by the TipTap rich editor (newer posts).
 *   - Markdown authored in the old textarea editor (legacy posts).
 *
 * We detect HTML by looking for a leading block-level tag, sanitize with
 * DOMPurify, and fall back to the existing markdown renderer otherwise.
 */
export function PostContent({ content }: { content: string }) {
  const trimmed = content.trimStart()
  const looksLikeHtml = /^<(?:p|h[1-6]|ul|ol|blockquote|pre|figure|img|hr|div|table)\b/i.test(trimmed)

  if (looksLikeHtml) {
    const clean = DOMPurify.sanitize(content, {
      ADD_ATTR: ["target", "rel"],
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
      FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
    })
    return (
      <div
        className="prose prose-sm md:prose-base max-w-none prose-headings:font-serif prose-headings:font-medium prose-a:text-primary prose-img:rounded-lg prose-blockquote:border-l-accent prose-blockquote:italic"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    )
  }

  return <ProseMarkdown>{content}</ProseMarkdown>
}
