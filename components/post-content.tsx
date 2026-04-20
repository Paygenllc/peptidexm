import { ProseMarkdown } from "./prose-markdown"

/**
 * Renders a blog post body safely. The same `content_markdown` column now
 * holds content in two possible formats:
 *   - HTML produced by the TipTap rich editor (newer posts).
 *   - Markdown authored in the old textarea editor (legacy posts).
 *
 * Content is already sanitized at write time by `lib/sanitize.ts` (which
 * runs DOMPurify server-side before storing). We deliberately do NOT
 * re-sanitize on read for two reasons:
 *   1. Loading isomorphic-dompurify in this module fails at runtime when
 *      jsdom can't initialize (the bug that broke blog rendering).
 *   2. PostContent is also used in the admin editor preview (a client
 *      component), so it must stay synchronous.
 *
 * Defense-in-depth still happens at the source (write path), and TipTap
 * generates safe HTML by construction, so the read-path renderer can
 * trust its input.
 */
export function PostContent({ content }: { content: string }) {
  const trimmed = content.trimStart()
  const looksLikeHtml = /^<(?:p|h[1-6]|ul|ol|blockquote|pre|figure|img|hr|div|table)\b/i.test(trimmed)

  if (looksLikeHtml) {
    return (
      <div
        className="prose prose-sm md:prose-base max-w-none prose-headings:font-serif prose-headings:font-medium prose-a:text-primary prose-img:rounded-lg prose-blockquote:border-l-accent prose-blockquote:italic"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  return <ProseMarkdown>{content}</ProseMarkdown>
}
