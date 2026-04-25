import "server-only"
import sharp from "sharp"
import { WATERMARK_WORDMARK_PNG_BASE64 } from "./_watermark-asset"

/**
 * Stamps the PeptideXM wordmark onto a generated image so every AI-
 * produced cover is brand-attributable when it gets reposted, scraped,
 * or screenshotted off-site.
 *
 * Why this is implemented by compositing a pre-rendered PNG asset
 * instead of rendering text at runtime: every previous attempt
 * (inline SVG <text>, then sharp's `{ text: { ... } }` Pango input)
 * worked locally and silently failed in production. On Vercel's
 * serverless runtime fontconfig either has no sans fallback at all
 * or resolves to a CJK-only font, so glyphs render as the empty
 * tofu boxes the customer reported. The static PNG asset
 * `public/_watermark-wordmark.png` is generated at build time by
 * `scripts/generate-watermark-asset.mjs` (which DOES have a working
 * font on the build machine), committed to the repo, and just
 * resampled here. No font lookup happens at request time.
 *
 * Layout choices, all expressed as fractions of the image's shortest
 * side so a 1024×1024 cover and a 1792×1024 hero get visually
 * identical marks:
 *   - Wordmark height ~3.5% of the short side (clamped to 18-56px).
 *   - 2.5% inset from the bottom-right corner, clamped to ≥10px.
 *   - 88% opacity so the mark is visible on light backgrounds but
 *     never overpowers the imagery.
 *   - A soft drop-shadow layer underneath for legibility on busy
 *     backgrounds (the same wordmark, blurred and shifted).
 *   - Output normalized to PNG so callers don't have to re-detect
 *     mime/extension after the watermark step.
 */

// Decoded once at module-init time. The base64 source is bundled
// into the function output by Next.js (see `_watermark-asset.ts`
// for the rationale), so this resolves synchronously from memory
// and never touches the filesystem at request time. That's the
// fix for the "tofu boxes" / blank-watermark bug — the previous
// readFile-from-public approach returned ENOENT in production
// because Vercel does not include `public/` in the function
// bundle.
const WORDMARK_BYTES = Buffer.from(WATERMARK_WORDMARK_PNG_BASE64, "base64")

// Cache the resized + shadow-prepared wordmark per target pixel
// height. Most generations land in the same hot Lambda, so we only
// pay the resize / blur cost once per cover-size class.
const renderedCache = new Map<
  number,
  Promise<{ wordmark: Buffer; shadow: Buffer; width: number; height: number }>
>()

async function getWordmark(targetHeightPx: number) {
  const cached = renderedCache.get(targetHeightPx)
  if (cached) return cached

  const promise = (async () => {
    const src = WORDMARK_BYTES

    // Resize to the requested pixel height; width follows aspect
    // ratio. The asset already has a transparent background and the
    // brand cream as its fill color, so no recoloring is needed.
    const resized = await sharp(src)
      .resize({ height: targetHeightPx, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true })

    // Pre-build a soft drop-shadow version of the same mark: blur +
    // darken the alpha. We composite this slightly offset under the
    // wordmark so it stays legible on bright/busy backgrounds.
    const shadow = await sharp(resized.data)
      .extractChannel("alpha")
      .blur(Math.max(1, Math.round(targetHeightPx * 0.12)))
      .toColourspace("b-w")
      .negate()
      // Convert the (now grayscale) buffer into an RGBA image where
      // RGB is black and A is the blurred alpha.
      .composite([
        {
          input: Buffer.from([0, 0, 0]),
          raw: { width: 1, height: 1, channels: 3 },
          tile: true,
          blend: "in",
        },
      ])
      .png()
      .toBuffer()

    return {
      wordmark: resized.data,
      shadow,
      width: resized.info.width,
      height: resized.info.height,
    }
  })()

  renderedCache.set(targetHeightPx, promise)
  return promise
}

export async function applyBrandWatermark(input: Uint8Array): Promise<Uint8Array> {
  const buf = Buffer.from(input)

  const meta = await sharp(buf).metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) {
    // No dimensions means we can't safely size or place the mark;
    // hand back the original bytes rather than producing something
    // mis-positioned. Cover-action callers tolerate this path.
    return new Uint8Array(buf)
  }

  const shortSide = Math.min(width, height)
  const targetHeightPx = Math.min(56, Math.max(18, Math.round(shortSide * 0.035)))
  const { wordmark, shadow, width: wmW, height: wmH } = await getWordmark(targetHeightPx)

  const inset = Math.max(10, Math.round(shortSide * 0.025))
  const left = Math.max(0, width - wmW - inset)
  const top = Math.max(0, height - wmH - inset)

  // 1px drop-shadow offset down/right scaled to the wordmark size.
  const shadowDx = Math.max(1, Math.round(targetHeightPx * 0.04))
  const shadowDy = Math.max(1, Math.round(targetHeightPx * 0.06))

  // Apply opacity to the wordmark by lowering its alpha channel.
  // Sharp's `joinChannel`/`linear` can do this in one pass; we keep
  // the original RGB and multiply alpha by 0.92 for the wordmark
  // and 0.55 for the shadow.
  const wordmarkOpaque = await sharp(wordmark)
    .ensureAlpha()
    .linear([1, 1, 1, 0.92], [0, 0, 0, 0])
    .png()
    .toBuffer()
  const shadowDimmed = await sharp(shadow)
    .ensureAlpha()
    .linear([1, 1, 1, 0.55], [0, 0, 0, 0])
    .png()
    .toBuffer()

  const composed = await sharp(buf)
    .composite([
      // Drop shadow first, slightly offset so it reads as a halo.
      { input: shadowDimmed, left: left + shadowDx, top: top + shadowDy },
      // Crisp cream wordmark on top.
      { input: wordmarkOpaque, left, top },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  // Return as Uint8Array so the call site can treat watermarked and
  // un-watermarked bytes interchangeably (Supabase Storage's upload
  // helper accepts both).
  return new Uint8Array(composed)
}
