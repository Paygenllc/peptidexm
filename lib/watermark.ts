import "server-only"
import sharp from "sharp"

/**
 * Stamps the PeptideXM wordmark onto a generated image so every AI-
 * produced cover is brand-attributable when it gets reposted, scraped,
 * or screenshotted off-site.
 *
 * Design choices:
 *   - Text-only "peptidexm.com" mark rendered as inline SVG. Avoids
 *     bundling a separate PNG asset, scales perfectly to any output
 *     resolution, and can be tinted to match the brand without an
 *     image-editing roundtrip.
 *   - A semi-transparent rounded "pill" sits underneath the text so
 *     the watermark stays legible on light AND dark covers — without
 *     it, a cream wordmark vanishes against a sandy background.
 *   - Anchored to the bottom-right with padding equal to ~3% of the
 *     image's shortest side. Keeps it out of the way of the centered
 *     hero subject typical for our cover prompts, while not getting
 *     clipped by Open Graph / Twitter card crops.
 *   - Output is always re-encoded as PNG. The image bytes that come
 *     out of Gemini's flash-image-preview are nominally PNG already;
 *     normalizing here means downstream callers don't have to think
 *     about whether sharp altered the container.
 */
export async function applyBrandWatermark(input: Uint8Array): Promise<Uint8Array> {
  // First read the source so we can size the watermark proportionally
  // to its actual dimensions. We do NOT trust upstream metadata; if
  // the model returns something exotic, sharp's metadata() is the
  // source of truth.
  const meta = await sharp(input).metadata()
  const width = meta.width ?? 1600
  const height = meta.height ?? 900

  // Layout math, all expressed as fractions of the smallest axis so
  // the mark looks identical on landscape, square, and portrait
  // outputs even though we currently only generate 16:9 landscapes.
  const minSide = Math.min(width, height)
  const fontSize = Math.max(14, Math.round(minSide * 0.024))
  const paddingX = Math.max(10, Math.round(minSide * 0.018))
  const paddingY = Math.max(6, Math.round(minSide * 0.011))
  const marginEdge = Math.max(12, Math.round(minSide * 0.028))
  const cornerRadius = Math.max(4, Math.round(fontSize * 0.45))

  // Approximate the rendered text width. librsvg doesn't expose a
  // metrics API, so we use a per-character width budget tuned to a
  // sans-serif at the chosen size. This only needs to be close
  // enough to size the pill — a couple of pixels of slack on either
  // side is invisible at cover scale.
  const label = "peptidexm.com"
  const approxCharWidth = fontSize * 0.55
  const textWidth = Math.ceil(approxCharWidth * label.length)
  const pillWidth = textWidth + paddingX * 2
  const pillHeight = Math.round(fontSize * 1.55) + paddingY * 2

  // Build the watermark as an SVG sized to fit the pill exactly,
  // then composite it onto the source at the bottom-right corner.
  // Keeping the SVG canvas the same size as the pill (rather than
  // the full image) means the composite call doesn't have to worry
  // about transparent padding bleeding into edge antialiasing.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${pillWidth}" height="${pillHeight}" viewBox="0 0 ${pillWidth} ${pillHeight}">
  <defs>
    <filter id="lift" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${Math.max(1, fontSize * 0.06)}" />
    </filter>
  </defs>
  <!-- Soft shadow puck for legibility on busy backgrounds. -->
  <rect x="0" y="0" width="${pillWidth}" height="${pillHeight}" rx="${cornerRadius}" ry="${cornerRadius}" fill="rgba(20,12,10,0.55)" filter="url(#lift)"/>
  <!-- Main pill, slightly inset so the blurred shadow shows through. -->
  <rect x="1" y="1" width="${pillWidth - 2}" height="${pillHeight - 2}" rx="${cornerRadius - 1}" ry="${cornerRadius - 1}" fill="rgba(20,12,10,0.62)"/>
  <text
    x="${pillWidth / 2}"
    y="${pillHeight / 2}"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="Helvetica, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="600"
    letter-spacing="${(fontSize * 0.02).toFixed(2)}"
    fill="#f5e9d4"
  >${label}</text>
</svg>`

  const overlay = Buffer.from(svg)

  const composed = await sharp(input)
    .composite([
      {
        input: overlay,
        top: height - pillHeight - marginEdge,
        left: width - pillWidth - marginEdge,
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  // Return as Uint8Array so the call site can treat the watermarked
  // and un-watermarked bytes interchangeably (Supabase Storage's
  // upload helper accepts both).
  return new Uint8Array(composed)
}
