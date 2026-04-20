import "server-only"

// Lazy-load isomorphic-dompurify to avoid module-load-time crashes when
// jsdom fails to initialize (missing native deps, bundler issues, etc.).
// The sanitize function catches all errors and falls back to a basic
// strip-all-tags approach so the action never throws.
let DOMPurify: typeof import("isomorphic-dompurify").default | null = null

async function getDOMPurify() {
  if (!DOMPurify) {
    try {
      const mod = await import("isomorphic-dompurify")
      DOMPurify = mod.default
    } catch (err) {
      console.log("[v0] Failed to load isomorphic-dompurify:", err)
      return null
    }
  }
  return DOMPurify
}

/**
 * Basic fallback: strip all HTML tags if DOMPurify fails to load.
 * This ensures content is safe (no XSS) even if the sanitizer is broken.
 */
function stripAllTags(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/**
 * Sanitize admin-authored blog post HTML before it ever hits the database.
 * We run the same sanitizer on the read path (`components/post-content.tsx`)
 * as defense-in-depth, but doing it here keeps stored content safe regardless
 * of how it's eventually rendered (e.g. RSS, emails, exports).
 *
 * Markdown strings (no leading HTML tag) pass through untouched.
 * If DOMPurify fails to load, we strip all tags as a safe fallback.
 */
export async function sanitizePostContent(input: string): Promise<string> {
  const trimmed = input.trimStart()
  const looksLikeHtml = /^<(?:p|h[1-6]|ul|ol|blockquote|pre|figure|img|hr|div|table)\b/i.test(trimmed)
  if (!looksLikeHtml) return input

  try {
    const purify = await getDOMPurify()
    if (!purify) {
      console.log("[v0] DOMPurify not available, stripping all tags")
      return stripAllTags(input)
    }
    return purify.sanitize(input, {
      ADD_ATTR: ["target", "rel"],
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
      FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
    })
  } catch (err) {
    console.log("[v0] sanitizePostContent error:", err)
    return stripAllTags(input)
  }
}
