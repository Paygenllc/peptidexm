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
}

export default nextConfig
