/**
 * One-shot favicon generator.
 *
 * Takes the user-provided XM logo (cream square with red serif "XM"
 * wordmark) and produces every icon variant the site references:
 *
 *   app/icon.png            — Next.js auto-served favicon
 *   app/apple-icon.png      — iOS home-screen icon (180x180)
 *   public/icon-192.png     — PWA manifest, "any" purpose
 *   public/icon-512.png     — PWA manifest, "any" purpose
 *   public/icon-maskable-512.png — PWA manifest, "maskable" purpose
 *   public/apple-icon.png   — fallback for non-app-router consumers
 *   public/icon-light-32x32.png + icon-dark-32x32.png
 *                           — referenced from the existing manifest
 *
 * The source image has a generous cream border which reads as wasted
 * space at 16-32px, so we trim the outer ~8% before resizing. For
 * the maskable variant we add the safe-zone padding back on so the
 * Android launcher's circle/squircle mask doesn't clip the letters.
 */
import sharp from "sharp"
import { mkdir, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"

const SOURCE = "scripts/__tmp__/xm-logo-source.png"
// Brand cream from globals.css — matches the site background so any
// transparent edges blend seamlessly when the icon is letterboxed.
const CREAM_BG = { r: 250, g: 245, b: 235, alpha: 1 }

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

async function writeResized(outPath, size, { maskable = false } = {}) {
  await ensureDir(outPath)

  // Step 1: take the source, trim away the wide cream border using
  // sharp's `trim` (it removes pixels matching the corners), then
  // re-pad on a flat cream square so the wordmark sits centered with
  // a ~10% margin. This dramatically improves legibility at small
  // sizes — the bare crop is what makes 32x32 favicons readable.
  const trimmed = await sharp(SOURCE).trim({ threshold: 10 }).toBuffer()

  // Step 2: pad. Maskable PWA icons need a 20% safe zone (Android
  // launcher masks aggressively), regular icons get a tight 8%
  // breathing room.
  const safeZone = maskable ? 0.2 : 0.08
  const innerSize = Math.round(size * (1 - safeZone * 2))

  const inner = await sharp(trimmed)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: CREAM_BG,
    })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: CREAM_BG,
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(outPath)

  console.log(`[v0] wrote ${outPath} (${size}x${size}${maskable ? ", maskable" : ""})`)
}

const targets = [
  // Next.js app router auto-discovers these. Putting `icon.png` here
  // alongside `icon.svg` would cause Next to inject both <link>s; we
  // instead delete the SVG below so the PNG is the canonical icon.
  { path: "app/icon.png", size: 512 },
  { path: "app/apple-icon.png", size: 180 },

  // Public folder: served verbatim, referenced by manifest + legacy
  // <link rel="apple-touch-icon"> consumers.
  { path: "public/icon-192.png", size: 192 },
  { path: "public/icon-512.png", size: 512 },
  { path: "public/icon-maskable-512.png", size: 512, maskable: true },
  { path: "public/apple-icon.png", size: 180 },
  { path: "public/icon-light-32x32.png", size: 32 },
  { path: "public/icon-dark-32x32.png", size: 32 },
]

for (const t of targets) {
  await writeResized(t.path, t.size, { maskable: !!t.maskable })
}

console.log("[v0] favicon generation complete")
