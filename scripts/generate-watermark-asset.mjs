/**
 * One-shot build script that bakes a "peptidexm.com" wordmark PNG.
 *
 * Why this exists: Sharp's `text:` input relies on the runtime's
 * fontconfig setup. On the development VM that's fine — system fonts
 * are present and `font: "sans bold"` resolves to something with
 * Latin glyphs. In Vercel's production runtime fontconfig falls back
 * to a font without Latin glyphs, so live `text:` rendering produces
 * empty boxes ("tofu") in the watermark.
 *
 * Workaround: rasterize the wordmark exactly once, here, in an
 * environment we control, and commit the resulting PNG. The runtime
 * watermarker then just composites a pre-rendered raster — no font
 * lookup involved.
 *
 * Re-run this whenever the wordmark text or style changes:
 *   node scripts/generate-watermark-asset.mjs
 */
import sharp from "sharp"
import { mkdirSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"

const projectRoot = resolve(import.meta.dirname, "..")
const outPath = resolve(projectRoot, "public/_watermark-wordmark.png")

// Render at 4x the largest size we'll ever composite at, so when the
// runtime scales the wordmark down to fit a particular cover it never
// has to upscale (which would expose anti-aliasing artifacts). The
// runtime caps watermark height around 36px, so 144px tall is plenty.
const HEIGHT = 144

// Shadow offset and blur tuned for legibility on both light and dark
// backgrounds. Drop shadows are what make a watermark readable on a
// busy hero image — without them, white text disappears into a
// cream-coloured studio shot.
const SHADOW_OFFSET = 4
const SHADOW_BLUR = 6

async function main() {
  // 1. Render the wordmark in white. We deliberately use the system
  //    font cache (which works fine in this build environment) and
  //    only do it once, here, where we can verify the output before
  //    committing.
  const whiteText = await sharp({
    text: {
      text: "peptidexm.com",
      font: `sans bold ${Math.round(HEIGHT * 0.7)}px`,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })

  console.log(`[v0] wordmark text: ${whiteText.info.width}x${whiteText.info.height}`)

  // 2. Build a soft drop shadow: take the same alpha mask, recolor it
  //    to near-black, blur it, and offset it down/right. This is what
  //    keeps the wordmark readable when the cover happens to be a
  //    bright cream studio backdrop (where pure white text vanishes).
  const shadow = await sharp(whiteText.data)
    .ensureAlpha()
    // Recolor: knock RGB to ~0 while preserving alpha, then drop alpha
    // to ~50% so the shadow isn't too aggressive.
    .composite([
      {
        input: Buffer.from([0, 0, 0, 128]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "in",
      },
    ])
    .blur(SHADOW_BLUR)
    .png()
    .toBuffer({ resolveWithObject: true })

  // 3. Compose: shadow underneath, offset by SHADOW_OFFSET, white
  //    wordmark on top at full opacity. Pad the canvas slightly so
  //    the shadow's blur doesn't get clipped at the edges.
  const pad = SHADOW_OFFSET + SHADOW_BLUR * 2
  const canvasW = whiteText.info.width + pad * 2
  const canvasH = whiteText.info.height + pad * 2

  const final = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: shadow.data,
        left: pad + SHADOW_OFFSET,
        top: pad + SHADOW_OFFSET,
      },
      {
        input: whiteText.data,
        left: pad,
        top: pad,
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true })

  // 4. Sanity check: alpha must have actual letterforms. If max alpha
  //    is 0 it means the build env is also missing fonts and we
  //    shouldn't commit a tofu-only image.
  const stats = await sharp(final.data).stats()
  const alphaMax = stats.channels[3]?.max ?? 0
  if (alphaMax === 0) {
    console.error(
      "[v0] FATAL: wordmark renders as empty. Fonts not available in this build environment.",
    )
    process.exit(1)
  }

  // 5. Write to public/ so it's served as a normal static asset and
  //    accessible via the filesystem at runtime.
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true })
  await sharp(final.data).png({ compressionLevel: 9 }).toFile(outPath)

  console.log(`[v0] wrote ${outPath} (${canvasW}x${canvasH}, alpha max=${alphaMax})`)
}

main().catch((err) => {
  console.error("[v0] watermark asset generation failed:", err)
  process.exit(1)
})
