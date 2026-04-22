/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // jsdom is a native Node dependency used by isomorphic-dompurify for
  // server-side HTML sanitization. Without this entry Turbopack tries to
  // bundle it and fails on native bindings (canvas, etc.).
  serverExternalPackages: ['jsdom'],

  // 301 redirects for the GLP-1 product rebrand. The four compounds
  // previously sold under their scientific names were renamed to
  // neutral XM-* codes (see lib/products-catalog.ts for the rationale).
  // Google and inbound links from blog posts, emails, and customer
  // bookmarks still point at the old URLs — these permanent redirects
  // forward them to the canonical new pages while preserving SEO
  // authority and the old links' click-through behavior.
  //
  // `permanent: true` emits HTTP 308 (the spec-preferred permanent
  // redirect that preserves request method); Next.js treats this as
  // semantically equivalent to 301 for crawlers and browsers.
  async redirects() {
    return [
      { source: '/products/tirzepatide',  destination: '/products/xm-t', permanent: true },
      { source: '/products/semaglutide',  destination: '/products/xm-s', permanent: true },
      { source: '/products/retatrutide',  destination: '/products/xm-r', permanent: true },
      { source: '/products/cagrilintide', destination: '/products/xm-c', permanent: true },
    ]
  },
}

export default nextConfig
