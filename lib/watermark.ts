import "server-only"
import sharp from "sharp"

/**
 * Stamps the PeptideXM wordmark onto a generated image so every AI-
 * produced cover is brand-attributable when it gets reposted, scraped,
 * or screenshotted off-site.
 *
 * Why this is implemented with sharp's native text API instead of
 * inline SVG `<text>`: the previous SVG-based approach silently
 * dropped the text on production runtimes. librsvg there couldn't
 * resolve `Helvetica, Arial, sans-serif` (no equivalent font
 * installed) and rendered each glyph as a zero-width box, which
 * produced an opaque dark "pill" with nothing visible inside —
 * exactly the empty-watermark bug the customer reported. Sharp's
 * `{ text: { ... } }` input goes through Pango + fontconfig, which
 * always has a sans fallback available, so the wordmark renders
 * deterministically across local dev, Vercel build sandboxes, and
 * Lambda. The `peptidexm.com` mark itself is now also explicitly the
 * URL string (not just an "XM" logo) per the customer's request, so
 * scraped covers carry a working domain.
 *
 * Layout choices, all expressed as fractions of the image's shortest
 * side so a 1024×1024 cover and a 1792×1024 hero get visually
 * identical marks:
 *   - Text height ~3.5% of the short side. Reads cleanly at thumbnail
 *     resolution (320px wide ≈ 11px tall) without dominating the
 *     hero crop.
 *   - Pill padding ~0.55× horizontally / 0.35× vertically. Gives the
 *     URL breathing room without making the puck feel chunky.
 *   - 2.5% inset from the bottom-right corner, clamped to ≥8px.
 *   - Output normalized to PNG so callers don't have to re-detect
 *     mime/extension after the watermark step.
 */

const WATERMARK_TEXT = "peptidexm.com"

// Cache the rendered wordmark per process, keyed by target text-pixel
// height. Most generations land in the same hot Lambda, so we only
// pay the text-rasterization cost once per cover-size class.
const wordmarkCache = new Map<
  number,
  Promise<{ data: Buffer; width: number; height: number }>
>()

async function renderWordmark(
  pixelHeight: number,
): Promise<{ data: Buffer; width: number; height: number }> {
  const cached = wordmarkCache.get(pixelHeight)
  if (cached) return cached

  // Pango font string: family + weight + size in px. We anchor DPI
  // at 72 so the px sizing in the font string matches output pixels
  // exactly (1pt @ 72dpi = 1px). The "sans" alias resolves through
  // fontconfig's default fallback chain on every supported runtime.
  const fontPx = Math.max(10, Math.round(pixelHeight * 0.78))
  const promise = (async () => {
    const out = await sharp({
      text: {
        text: WATERMARK_TEXT,
        font: `sans bold ${fontPx}px`,
        rgba: true,
        dpi: 72,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true })
    return { data: out.data, width: out.info.width, height: out.info.height }
  })()
  wordmarkCache.set(pixelHeight, promise)
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
  const textPixelHeight = Math.max(18, Math.round(shortSide * 0.035))
  const wordmark = await renderWordmark(textPixelHeight)

  const padX = Math.round(textPixelHeight * 0.55)
  const padY = Math.round(textPixelHeight * 0.35)
  const pillW = wordmark.width + padX * 2
  const pillH = wordmark.height + padY * 2
  const radius = Math.round(pillH / 2)

  const inset = Math.max(8, Math.round(shortSide * 0.025))
  const left = Math.max(0, width - pillW - inset)
  const top = Math.max(0, height - pillH - inset)

  // The pill is a font-free SVG primitive (rect + rx). librsvg
  // handles this without any font resolution, so it's safe even on
  // runtimes where text rendering would have failed.
  const pillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pillW}" height="${pillH}" viewBox="0 0 ${pillW} ${pillH}"><rect x="0" y="0" width="${pillW}" height="${pillH}" rx="${radius}" ry="${radius}" fill="rgba(20,12,10,0.6)"/></svg>`
  const pill = await sharp(Buffer.from(pillSvg)).png().toBuffer()

  // Sharp's text rasterizer outputs near-black glyphs on a transparent
  // background. To recolor to the brand cream without re-rendering,
  // we use a per-channel `linear` to slam RGB toward (245, 233, 212)
  // while preserving the original alpha mask (anti-aliased edges).
  // Multiplier 0 + offset N effectively replaces the channel value
  // with N for every non-transparent pixel.
  const tintedText = await sharp(wordmark.data)
    .ensureAlpha()
    .linear([0, 0, 0, 1], [245, 233, 212, 0])
    .png()
    .toBuffer()

  const composed = await sharp(buf)
    .composite([
      // 1. Dark translucent pill in the bottom-right.
      { input: pill, left, top },
      // 2. The "peptidexm.com" wordmark, padded inside the pill.
      { input: tintedText, left: left + padX, top: top + padY },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  // Return as Uint8Array so the call site can treat watermarked and
  // un-watermarked bytes interchangeably (Supabase Storage's upload
  // helper accepts both).
  return new Uint8Array(composed)
}
