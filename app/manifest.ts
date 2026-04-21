import type { MetadataRoute } from "next"

/**
 * PWA manifest.
 *
 * Chrome uses this to decide what to show in the install prompt (the
 * "app" card you see at the top of the window), the Add-to-Home-Screen
 * flow on mobile, and the browser's app shortcut list. The icon array
 * below is ordered so that the PNG 512x512 icon is the primary choice
 * — Chrome specifically looks for a 192+ or 512+ PNG with `purpose:
 * "any"` before it will display our brand icon instead of the build
 * tool's default. The `maskable` variant is what Android uses for its
 * adaptive-icon mask; without it, some launchers clip the logo.
 *
 * Brand: PeptideXM. No "v0" or build-tool naming may appear here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PeptideXM",
    short_name: "PeptideXM",
    description: "Premium research peptides with lab-tested purity.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf8",
    theme_color: "#fafaf8",
    icons: [
      // Primary: 512x512 PNG, purpose "any". This is the one Chrome's
      // install card actually renders. Must come first.
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // 192x192 PNG for older PWA / Android home-screen targets.
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      // Maskable variant for Android adaptive icons — painted onto a
      // dark brand tile so the launcher's circle/squircle mask never
      // clips the logo.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      // SVG fallback last — some browsers will prefer it, but Chrome's
      // install UI won't.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  }
}
