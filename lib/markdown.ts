import "server-only"

/**
 * Extremely small, dependency-free markdown -> HTML / plaintext converter.
 *
 * We use this for composing transactional-ish marketing emails and public
 * blog posts. For blog posts we render via `react-markdown` in the browser,
 * but for emails we need server-side HTML output that doesn't require a full
 * remark pipeline at request time.
 *
 * Supports: headings, paragraphs, bold, italic, inline code, links, unordered
 * lists, ordered lists, blockquotes, horizontal rules, and line breaks.
 *
 * Does NOT support: tables, nested lists, code fences, images, HTML passthrough.
 * That's fine — admins who need rich content can paste HTML into the body and
 * we sanitize-then-pass-through inline.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function inline(s: string): string {
  let out = escapeHtml(s)
  // Links: [text](url) — restrict schemes to http(s)/mailto to avoid XSS via javascript:
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, text, href) => {
    return `<a href="${href}" style="color:#8b5e34;text-decoration:underline;">${text}</a>`
  })
  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  // Italic _text_
  out = out.replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>")
  // Inline code `code`
  out = out.replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:0.9em;">$1</code>')
  return out
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let inUl = false
  let inOl = false
  let paragraphBuffer: string[] = []

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return
    const html = inline(paragraphBuffer.join(" ").trim())
    if (html) out.push(`<p style="margin:0 0 16px 0;">${html}</p>`)
    paragraphBuffer = []
  }
  const closeLists = () => {
    if (inUl) {
      out.push("</ul>")
      inUl = false
    }
    if (inOl) {
      out.push("</ol>")
      inOl = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushParagraph()
      closeLists()
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushParagraph()
      closeLists()
      out.push('<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;" />')
      continue
    }

    // Headings
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      closeLists()
      const level = heading[1].length
      const sizes = { 1: "26px", 2: "20px", 3: "16px" } as const
      out.push(
        `<h${level} style="font-family:Georgia,serif;font-size:${sizes[level as 1 | 2 | 3]};margin:24px 0 12px 0;font-weight:500;">${inline(heading[2])}</h${level}>`,
      )
      continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushParagraph()
      closeLists()
      out.push(
        `<blockquote style="border-left:3px solid #ecd8c0;padding:4px 16px;margin:16px 0;color:#6b7280;font-style:italic;">${inline(line.slice(2))}</blockquote>`,
      )
      continue
    }

    // Unordered list
    const ul = /^[-*]\s+(.*)$/.exec(line)
    if (ul) {
      flushParagraph()
      if (inOl) {
        out.push("</ol>")
        inOl = false
      }
      if (!inUl) {
        out.push('<ul style="margin:0 0 16px 20px;padding:0;">')
        inUl = true
      }
      out.push(`<li style="margin:4px 0;">${inline(ul[1])}</li>`)
      continue
    }

    // Ordered list
    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      flushParagraph()
      if (inUl) {
        out.push("</ul>")
        inUl = false
      }
      if (!inOl) {
        out.push('<ol style="margin:0 0 16px 20px;padding:0;">')
        inOl = true
      }
      out.push(`<li style="margin:4px 0;">${inline(ol[1])}</li>`)
      continue
    }

    // Paragraph line
    closeLists()
    paragraphBuffer.push(line)
  }

  flushParagraph()
  closeLists()
  return out.join("\n")
}

export function markdownToPlainText(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, (m) => m)
    .trim()
}
