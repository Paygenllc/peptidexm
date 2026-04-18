import type { MetadataRoute } from "next"

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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
