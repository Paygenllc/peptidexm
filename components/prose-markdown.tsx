import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Renders markdown content with the site's typography.
// Used by both the public blog pages and the admin preview.
// Scripts and raw HTML are disabled by default in react-markdown (safe).
export function ProseMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h1:text-3xl prose-h1:sm:text-4xl prose-h1:font-medium prose-h2:text-2xl prose-h2:font-medium prose-h2:mt-10 prose-h3:text-xl prose-h3:font-medium prose-h3:mt-8 prose-p:leading-relaxed prose-p:text-foreground/85 prose-li:text-foreground/85 prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-blockquote:border-l-accent prose-blockquote:text-foreground/75 prose-img:rounded-lg prose-hr:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
