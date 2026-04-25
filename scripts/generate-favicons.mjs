/**
 * One-shot favicon generator.
 *
 * Takes the user-provided XM logo (full-bleed terracotta square with
 * a cream serif "XM" wordmark — possibly carrying a small generator
 * watermark in the bottom-right corner) and produces every icon
 * variant the site references:
 *
 *   app/icon.png                  — Next.js auto-served favicon
 *   app/apple-icon.png            — iOS home-screen icon (180x180)
 *   public/icon-192.png           — PWA manifest, "any" purpose
 *   public/icon-512.png           — PWA manifest, "any" purpose
 *   public/icon-maskable-512.png  — PWA manifest, "maskable" purpose
 *   public/apple-icon.png         — fallback for non-app-router consumers
 *   public/icon-light-32x32.png + icon-dark-32x32.png
 *                                 — referenced from the existing manifest
 *
 * Pipeline:
 *
 *  1. Pre-crop the source by a uniform percentage on every side. The
 *     uniform trim removes the bottom-right watermark while keeping
 *     the wordmark perfectly centered — asymmetric crops would shift
 *     the XM off-axis at small favicon sizes where every pixel of
 *     centering matters.
 *
 *  2. Sample the background color from a corner pixel of the
 *     post-crop image. This way the script always pads with the
 *     exact brand red present in the source, even if the user
 *     swaps in a slightly different shade later.
 *
 *  3. Emit each target. Non-maskable icons are a straight resize of
 *     the cropped square (no extra padding — the source is already
 *     full-bleed). The maskable variant scales the wordmark down to
 *     the inner 60% so Android's circular/squircle mask doesn't clip
 *     the X's leg or the M's right serif, then re-pads to the full
 *     square in the sampled brand red.
 */
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

const SOURCE = "scripts/__tmp__/xm-logo-source.png"

// How much to shave off every side before resizing. 5% from each
// side (10% total each axis) is enough to remove the small
// generator watermark in the bottom-right while preserving the
// X's left foot and the M's right foot, which sit roughly 8% in
// from the source edges.
const TRIM_RATIO = 0.05

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

// Pre-process the source once: uniform trim and probe the bg color.
// Returning the cropped buffer means every per-target write is just
// a resize/composite step — no repeated I/O against the source PNG.
async function preprocess() {
  const meta = await sharp(SOURCE).metadata()
  const { width, height } = meta
  const trimX = Math.round(width * TRIM_RATIO)
  const trimY = Math.round(height * TRIM_RATIO)

  const cropped = await sharp(SOURCE)
    .extract({
      left: trimX,
      top: trimY,
      width: width - trimX * 2,
      height: height - trimY * 2,
    })
    .toBuffer()

  // Sample the top-left pixel of the cropped image — guaranteed to
  // be background after the symmetric trim, so it's the exact brand
  // red the artwork was drawn on. Falls back to a hardcoded
  // terracotta if sharp returns an alpha-only buffer for any reason.
  const sample = await sharp(cropped)
    .extract({ left: 4, top: 4, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer()
  const bg =
    sample.length >= 3
      ? { r: sample[0], g: sample[1], b: sample[2], alpha: 1 }
      : { r: 184, g: 80, b: 64, alpha: 1 }

  return { cropped, bg }
}

async function writeResized(outPath, size, source, bg, { maskable = false } = {}) {
  await ensureDir(outPath)

  if (!maskable) {
    // Source is already a full-bleed square in the brand red, so a
    // straight resize gives the cleanest possible result with zero
    // letterboxing.
    await sharp(source)
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(outPath)
  } else {
    // Maskable PWA icon: keep a 20% safe zone on every side so the
    // Android launcher's mask doesn't clip the wordmark.
    const safeZone = 0.2
    const innerSize = Math.round(size * (1 - safeZone * 2))

    const inner = await sharp(source)
      .resize(innerSize, innerSize, { fit: "cover" })
      .toBuffer()

    await sharp({
      create: { width: size, height: size, channels: 4, background: bg },
    })
      .composite([{ input: inner, gravity: "center" }])
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(outPath)
  }

  console.log(`[v0] wrote ${outPath} (${size}x${size}${maskable ? ", maskable" : ""})`)
}

const targets = [
  // Next.js app router auto-discovers these.
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

const { cropped, bg } = await preprocess()
console.log(`[v0] sampled background: rgb(${bg.r}, ${bg.g}, ${bg.b})`)

for (const t of targets) {
  await writeResized(t.path, t.size, cropped, bg, { maskable: !!t.maskable })
}

console.log("[v0] favicon generation complete")
