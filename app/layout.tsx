import type { Metadata, Viewport } from "next"
import { DM_Serif_Display, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { CartProvider } from "@/context/cart-context"
import { AuthErrorBridge } from "@/components/auth-error-bridge"
import { AttributionBeacon } from "@/components/attribution-beacon"
import "./globals.css"

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.peptidexm.com"
const siteName = "PeptideXM"
const siteDescription =
  "Premium research peptides from PeptideXM. Lab-tested Tirzepatide, Semaglutide, Retatrutide, BPC-157, Sermorelin and 45+ more compounds with 98%+ purity and fast domestic shipping."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — Premium Research Peptides`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  generator: "v0.app",
  keywords: [
    "research peptides",
    "buy peptides",
    "Tirzepatide",
    "Semaglutide",
    "Retatrutide",
    "Cagrilintide",
    "BPC-157",
    "TB-500",
    "Sermorelin",
    "Ipamorelin",
    "GLP-1 research",
    "GHK-Cu",
    "Epithalon",
    "NAD+",
    "MK-677",
    "PeptideXM",
  ],
  authors: [{ name: "PeptideXM" }],
  creator: "PeptideXM",
  publisher: "PeptideXM",
  category: "Research Chemicals",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: `${siteName} — Premium Research Peptides`,
    description: siteDescription,
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${siteName} — lab-tested research peptides`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — Premium Research Peptides`,
    description: siteDescription,
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Favicon is served automatically from app/icon.svg (Next.js App Router convention).
  manifest: "/manifest.webmanifest",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${inter.variable} ${dmSerif.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Skip to content
        </a>
        <AuthErrorBridge />
        <AttributionBeacon />
        <CartProvider>{children}</CartProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
