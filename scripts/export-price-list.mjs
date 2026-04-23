// Exports a full price list of every product + variant from the live
// Supabase DB into a formatted .xlsx workbook, then uploads it to
// Vercel Blob and prints the public download URL.
//
// Three sheets are produced:
//   1. "Price List"        — every variant, with a computed "9x Match?"
//                            column that flags any kit-of-10 row whose
//                            price isn't exactly 9× the matching single.
//   2. "Pricing Audit"     — just the ✗ rows from sheet 1, for quick
//                            triage by the ops team.
//   3. "Legacy Duplicates" — the ~68 orphan generic
//                            "Single Vial" / "Kit of 10 Vials" rows
//                            that were never retired when the
//                            strength-specific variants shipped.
//                            These are live in the DB but don't appear
//                            in the storefront picker.
//
// Run:
//   node --env-file-if-exists=/vercel/share/.env.project \
//        scripts/export-price-list.mjs

import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
// Service-role key needed because RLS may hide products from anon.
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.',
  )
  process.exit(1)
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    'Missing BLOB_READ_WRITE_TOKEN in the environment. Vercel Blob integration must be connected.',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('[v0] Fetching products + variants from Supabase...')

const { data: products, error: pErr } = await supabase
  .from('products')
  .select('id, slug, name, category, purity, active, featured')
  .order('category', { ascending: true })
  .order('name', { ascending: true })

if (pErr) {
  console.error('Failed to fetch products:', pErr.message)
  process.exit(1)
}

const { data: variants, error: vErr } = await supabase
  .from('product_variants')
  .select('id, product_id, variant_name, price, stock, sku, sort_order')

if (vErr) {
  console.error('Failed to fetch variants:', vErr.message)
  process.exit(1)
}

// Build a lookup: product_id -> product
const productsById = new Map(products.map((p) => [p.id, p]))

// Normalize helpers
const stripDash = (s) =>
  String(s || '')
    .split('—')[0]
    .trim()
    .toLowerCase()

const isSingleVial = (name) => /single vial$/i.test(String(name || ''))
const isKitOf10Vials = (name) => /kit of 10 vials$/i.test(String(name || ''))

// For each product, map strength-prefix → { single, kit }
const pairsByProduct = new Map()
for (const v of variants) {
  if (!productsById.has(v.product_id)) continue
  const strengthKey = stripDash(v.variant_name) // '' for generic, '2mg' etc otherwise
  const bucket = pairsByProduct.get(v.product_id) || new Map()
  const pair = bucket.get(strengthKey) || {}
  if (isSingleVial(v.variant_name)) pair.single = v
  if (isKitOf10Vials(v.variant_name)) pair.kit = v
  bucket.set(strengthKey, pair)
  pairsByProduct.set(v.product_id, bucket)
}

// Attach product row to each variant + enriched columns
const enriched = variants
  .filter((v) => productsById.has(v.product_id))
  .map((v) => {
    const p = productsById.get(v.product_id)
    const strengthKey = stripDash(v.variant_name)
    const pair = pairsByProduct.get(v.product_id)?.get(strengthKey) || {}

    let singlePrice = null
    let ninexPrice = null
    let match = null

    if (isKitOf10Vials(v.variant_name) && pair.single) {
      singlePrice = Number(pair.single.price)
      ninexPrice = Math.round(singlePrice * 9 * 100) / 100
      match =
        Math.abs(Number(v.price) - ninexPrice) < 0.005 ? '✓' : '✗'
    }

    // Flag legacy generic rows: variant_name has no em-dash and is
    // either "Single Vial" or "Kit of 10 Vials", AND the same
    // product has at least one strength-specific variant.
    const hasStrengthVariants = [
      ...(pairsByProduct.get(v.product_id)?.keys() || []),
    ].some((k) => k !== '')
    const isGenericLegacy =
      hasStrengthVariants &&
      (isSingleVial(v.variant_name) || isKitOf10Vials(v.variant_name)) &&
      strengthKey === ''

    return {
      category: p.category || '',
      product_name: p.name,
      slug: p.slug,
      purity: p.purity || '',
      variant_name: v.variant_name,
      price: Number(v.price),
      single_price: singlePrice,
      ninex_price: ninexPrice,
      match: match,
      active: p.active !== false,
      featured: !!p.featured,
      stock: v.stock ?? '',
      sku: v.sku || '',
      sort_order: v.sort_order ?? 999,
      is_legacy: isGenericLegacy,
    }
  })
  .sort((a, b) => {
    const c =
      (a.category || '~').localeCompare(b.category || '~') ||
      a.product_name.localeCompare(b.product_name) ||
      a.sort_order - b.sort_order ||
      a.price - b.price
    return c
  })

console.log(`[v0] Enriched ${enriched.length} variant rows.`)

// ---------------------------------------------------------------------
// Build workbook
// ---------------------------------------------------------------------
const wb = new ExcelJS.Workbook()
wb.creator = 'PeptideXM'
wb.created = new Date()

const priceListCols = [
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Product', key: 'product_name', width: 34 },
  { header: 'Slug', key: 'slug', width: 22 },
  { header: 'Purity', key: 'purity', width: 10 },
  { header: 'Variant', key: 'variant_name', width: 28 },
  { header: 'Price (USD)', key: 'price', width: 13 },
  { header: 'Single Price', key: 'single_price', width: 13 },
  { header: '9× Kit Price', key: 'ninex_price', width: 13 },
  { header: 'Match?', key: 'match', width: 9 },
  { header: 'Active', key: 'active', width: 9 },
  { header: 'Featured', key: 'featured', width: 11 },
  { header: 'Stock', key: 'stock', width: 9 },
  { header: 'SKU', key: 'sku', width: 16 },
]

function styleHeader(sheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 22
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

// Sheet 1: Price List
const s1 = wb.addWorksheet('Price List')
s1.columns = priceListCols
for (const r of enriched) {
  s1.addRow({
    category: r.category,
    product_name: r.product_name,
    slug: r.slug,
    purity: r.purity,
    variant_name: r.variant_name,
    price: r.price,
    single_price: r.single_price ?? '',
    ninex_price: r.ninex_price ?? '',
    match: r.match ?? '',
    active: r.active ? 'Yes' : 'No',
    featured: r.featured ? 'Yes' : '',
    stock: r.stock,
    sku: r.sku,
  })
}
styleHeader(s1)
// USD format on price columns
for (const col of ['F', 'G', 'H']) {
  s1.getColumn(col).numFmt = '"$"#,##0.00'
  s1.getColumn(col).alignment = { horizontal: 'right' }
}
// Match column color
s1.getColumn('I').eachCell((cell, rowNumber) => {
  if (rowNumber === 1) return
  if (cell.value === '✓')
    cell.font = { color: { argb: 'FF0F7B0F' }, bold: true }
  if (cell.value === '✗')
    cell.font = { color: { argb: 'FFB1121D' }, bold: true }
})
s1.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: priceListCols.length },
}

// Sheet 2: Pricing Audit (mismatches only)
const mismatches = enriched.filter((r) => r.match === '✗')
const s2 = wb.addWorksheet('Pricing Audit')
s2.columns = priceListCols
for (const r of mismatches) {
  s2.addRow({
    category: r.category,
    product_name: r.product_name,
    slug: r.slug,
    purity: r.purity,
    variant_name: r.variant_name,
    price: r.price,
    single_price: r.single_price ?? '',
    ninex_price: r.ninex_price ?? '',
    match: r.match ?? '',
    active: r.active ? 'Yes' : 'No',
    featured: r.featured ? 'Yes' : '',
    stock: r.stock,
    sku: r.sku,
  })
}
styleHeader(s2)
for (const col of ['F', 'G', 'H']) {
  s2.getColumn(col).numFmt = '"$"#,##0.00'
  s2.getColumn(col).alignment = { horizontal: 'right' }
}

// Sheet 3: Legacy Duplicates
const legacy = enriched.filter((r) => r.is_legacy)
const s3 = wb.addWorksheet('Legacy Duplicates')
s3.columns = priceListCols
for (const r of legacy) {
  s3.addRow({
    category: r.category,
    product_name: r.product_name,
    slug: r.slug,
    purity: r.purity,
    variant_name: r.variant_name,
    price: r.price,
    single_price: r.single_price ?? '',
    ninex_price: r.ninex_price ?? '',
    match: r.match ?? '',
    active: r.active ? 'Yes' : 'No',
    featured: r.featured ? 'Yes' : '',
    stock: r.stock,
    sku: r.sku,
  })
}
styleHeader(s3)
for (const col of ['F', 'G', 'H']) {
  s3.getColumn(col).numFmt = '"$"#,##0.00'
  s3.getColumn(col).alignment = { horizontal: 'right' }
}

// ---------------------------------------------------------------------
// Upload to Vercel Blob
// ---------------------------------------------------------------------
const buffer = Buffer.from(await wb.xlsx.writeBuffer())

// Timestamped key so new runs don't silently overwrite older exports
// and so the CDN-cached URL stays predictable per-export.
const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
const key = `price-lists/peptidexm-price-list-${stamp}.xlsx`

console.log(`[v0] Uploading to Vercel Blob: ${key} (${buffer.length} bytes)`)

const blob = await put(key, buffer, {
  access: 'public',
  contentType:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  addRandomSuffix: false, // stable URL per date
  allowOverwrite: true, // re-runs on the same day replace the file
})

console.log('')
console.log('==================================================')
console.log('  Price list uploaded to Vercel Blob')
console.log('==================================================')
console.log(`  URL:     ${blob.url}`)
console.log(`  Rows:    ${enriched.length}`)
console.log(`  Audit:   ${mismatches.length} mismatch(es)`)
console.log(`  Legacy:  ${legacy.length} duplicate variant(s)`)
console.log('==================================================')
