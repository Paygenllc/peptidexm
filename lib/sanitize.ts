import "server-only"

import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitize admin-authored blog post HTML before it ever hits the database.
 * We run the same sanitizer on the read path (`components/post-content.tsx`)
 * as defense-in-depth, but doing it here keeps stored content safe regardless
 * of how it's eventually rendered (e.g. RSS, emails, exports).
 *
 * Markdown strings (no leading HTML tag) pass through untouched.
 */
export function sanitizePostContent(input: string): string {
  const trimmed = input.trimStart()
  const looksLikeHtml = /^<(?:p|h[1-6]|ul|ol|blockquote|pre|figure|img|hr|div|table)\b/i.test(trimmed)
  if (!looksLikeHtml) return input

  return DOMPurify.sanitize(input, {
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  })
}
