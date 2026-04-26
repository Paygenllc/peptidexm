import "server-only"
import sharp from "sharp"
import { WATERMARK_WORDMARK_PNG_BASE64 } from "./_watermark-asset"

/**
 * Stamps the PeptideXM wordmark onto a generated image so every AI-
 * produced cover is brand-attributable when it gets reposted, scraped,
 * or screenshotted off-site.
 *
 * Implementation history (read before "improving" this file):
 *
 *   1. Inline SVG <text>            → silently rendered empty in
 *                                     production (librsvg had no
 *                                     fontconfig fallback).
 *   2. sharp({ text: { ... } })     → silently rendered tofu boxes
 *                                     in production (Pango fell back
 *                                     to a CJK-only font on Vercel).
 *   3. readFile(public/_wm.png)     → silently returned ENOENT in
 *                                     production (Vercel does not
 *                                     bundle public/ into the
 *                                     serverless function output).
 *   4. Static PNG via base64 import → text rendered, but a fancy
 *                                     drop-shadow + linear() alpha
 *                                     pipeline produced subtly
 *                                     broken output on Vercel's
 *                                     Sharp build (the user reported
 *                                     "no text still").
 *
 * Current approach (this file): the wordmark PNG is bundled into
 * the function output as a base64 string in `_watermark-asset.ts`,
 * decoded once at module-init time, resized per-cover, and composited
 * with Sharp's built-in `composite.opacity` parameter. No alpha
 * arithmetic, no shadow layer, no Pango. Sharp's PNG composite path
 * is the most battle-tested code in the entire library, so this
 * should be the last redesign.
 */

// Decoded once when this module is first imported by a Lambda. The
// base64 source is bundled into the function output by Next.js's
// import graph (see `_watermark-asset.ts` for the rationale), so
// this resolves synchronously from memory and never touches the
// filesystem or fontconfig at request time.
const WORDMARK_BYTES = Buffer.from(WATERMARK_WORDMARK_PNG_BASE64, "base64")

// Memoize the resized wordmark per target pixel height. Most blog
// covers come back at the same aspect, so we usually pay the resize
// cost once per warm Lambda.
const sizedCache = new Map<number, Promise<{ data: Buffer; width: number; height: number }>>()

async function getSizedWordmark(targetHeightPx: number) {
  const cached = sizedCache.get(targetHeightPx)
  if (cached) return cached

  const promise = (async () => {
    // Re-encode as PNG explicitly. The original asset is already
    // PNG, but going through .png() guarantees alpha is preserved
    // even if Sharp's metadata sniffer ever changes its default.
    const out = await sharp(WORDMARK_BYTES)
      .resize({ height: targetHeightPx, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true })
    return { data: out.data, width: out.info.width, height: out.info.height }
  })()

  sizedCache.set(targetHeightPx, promise)
  return promise
}

export async function applyBrandWatermark(input: Uint8Array): Promise<Uint8Array> {
  const buf = Buffer.from(input)

  // Read dimensions of the cover so we can size the wordmark
  // proportionally. If sharp can't decode it, hand back the
  // original bytes rather than producing something mis-positioned;
  // the cover-generation flow tolerates an un-watermarked fallback.
  const meta = await sharp(buf).metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) return new Uint8Array(buf)

  // Wordmark height is ~4.5% of the image's shortest side, clamped
  // 24-72px. That keeps the mark visible on small social-card
  // crops (480px) without overpowering full-bleed hero images.
  const shortSide = Math.min(width, height)
  const targetHeightPx = Math.min(72, Math.max(24, Math.round(shortSide * 0.045)))
  const { data: wm, width: wmW, height: wmH } = await getSizedWordmark(targetHeightPx)

  // Inset from bottom-right by ~3% of the shortest side (≥12px so
  // the mark never crowds the corner on tiny outputs).
  const inset = Math.max(12, Math.round(shortSide * 0.03))
  const left = Math.max(0, width - wmW - inset)
  const top = Math.max(0, height - wmH - inset)

  // Composite the wordmark with 90% opacity. Sharp's `composite`
  // applies opacity by multiplying the input alpha — this is the
  // built-in path and works identically across every Sharp build
  // we've tested. No alpha-channel surgery, no shadow layer.
  const composed = await sharp(buf)
    .composite([{ input: wm, left, top, opacity: 0.9 }])
    .png({ compressionLevel: 9 })
    .toBuffer()

  return new Uint8Array(composed)
}
