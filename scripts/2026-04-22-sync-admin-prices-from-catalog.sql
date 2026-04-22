-- =============================================================================
-- Sync admin product prices with the canonical catalog
-- =============================================================================
-- Source of truth: lib/products-catalog.ts. Every Single Vial / Kit of 10
-- price below was lifted verbatim from that file. The kit price uses the
-- catalog's own pricing rule: round(vial_price * 4.5).
--
-- Strategy
-- --------
-- 1. CTE `canonical` is the full target variant list, 100+ rows.
-- 2. UPDATE product_variants where (slug, variant_name) matches — fixes prices
--    and restores the canonical sort_order.
-- 3. INSERT canonical variants that don't yet exist (Tirzepatide currently
--    ships only 2 of its 12 strengths in the DB, for example).
--
-- Safety
-- ------
-- - No DELETEs. `order_items.variant_id` is a FK to product_variants.id, so
--   removing rows would orphan past-order line items. Legacy variants that
--   don't match the canonical list stay in place and can be cleaned up via
--   the admin UI once you've confirmed they're not referenced by orders.
-- - Idempotent: running it twice is a no-op on the second run.
-- - Wrapped in a transaction: any failed row rolls everything back.
-- =============================================================================

begin;

-- One reusable temp table so UPDATE and INSERT read from the same canonical
-- list without us re-declaring the 100-row VALUES clause twice.
create temporary table tmp_canonical_variants (
  slug          text not null,
  variant_name  text not null,
  price         numeric(10, 2) not null,
  sort_order    integer not null,
  primary key (slug, variant_name)
) on commit drop;

insert into tmp_canonical_variants (slug, variant_name, price, sort_order) values
  -- ===== GLP-1 =====
  ('tirzepatide',  '2mg — Single Vial',        60.00,   1),
  ('tirzepatide',  '2mg — Kit of 10 Vials',    270.00,  2),
  ('tirzepatide',  '5mg — Single Vial',        80.00,   3),
  ('tirzepatide',  '5mg — Kit of 10 Vials',    360.00,  4),
  ('tirzepatide',  '10mg — Single Vial',       120.00,  5),
  ('tirzepatide',  '10mg — Kit of 10 Vials',   540.00,  6),
  ('tirzepatide',  '15mg — Single Vial',       180.00,  7),
  ('tirzepatide',  '15mg — Kit of 10 Vials',   810.00,  8),
  ('tirzepatide',  '30mg — Single Vial',       280.00,  9),
  ('tirzepatide',  '30mg — Kit of 10 Vials',   1260.00, 10),
  ('tirzepatide',  '60mg — Single Vial',       540.00,  11),
  ('tirzepatide',  '60mg — Kit of 10 Vials',   2430.00, 12),

  ('semaglutide',  '2mg — Single Vial',        50.00,   1),
  ('semaglutide',  '2mg — Kit of 10 Vials',    225.00,  2),
  ('semaglutide',  '5mg — Single Vial',        76.00,   3),
  ('semaglutide',  '5mg — Kit of 10 Vials',    342.00,  4),
  ('semaglutide',  '10mg — Single Vial',       140.00,  5),
  ('semaglutide',  '10mg — Kit of 10 Vials',   630.00,  6),

  ('retatrutide',  '10mg — Single Vial',       180.00,  1),
  ('retatrutide',  '10mg — Kit of 10 Vials',   810.00,  2),
  ('retatrutide',  '20mg — Single Vial',       260.00,  3),
  ('retatrutide',  '20mg — Kit of 10 Vials',   1170.00, 4),

  ('cagrilintide', '5mg — Single Vial',        80.00,   1),
  ('cagrilintide', '5mg — Kit of 10 Vials',    360.00,  2),
  ('cagrilintide', '10mg — Single Vial',       160.00,  3),
  ('cagrilintide', '10mg — Kit of 10 Vials',   720.00,  4),

  ('aod-9604',     '2mg — Single Vial',        60.00,   1),
  ('aod-9604',     '2mg — Kit of 10 Vials',    270.00,  2),
  ('aod-9604',     '5mg — Single Vial',        120.00,  3),
  ('aod-9604',     '5mg — Kit of 10 Vials',    540.00,  4),

  -- ===== Growth Hormone =====
  ('sermorelin',    '2mg — Single Vial',       60.00,   1),
  ('sermorelin',    '2mg — Kit of 10 Vials',   270.00,  2),
  ('sermorelin',    '5mg — Single Vial',       100.00,  3),
  ('sermorelin',    '5mg — Kit of 10 Vials',   450.00,  4),

  ('tesamorelin',   '2mg — Single Vial',       60.00,   1),
  ('tesamorelin',   '2mg — Kit of 10 Vials',   270.00,  2),
  ('tesamorelin',   '5mg — Single Vial',       120.00,  3),
  ('tesamorelin',   '5mg — Kit of 10 Vials',   540.00,  4),
  ('tesamorelin',   '10mg — Single Vial',      160.00,  5),
  ('tesamorelin',   '10mg — Kit of 10 Vials',  720.00,  6),

  ('cjc-1295-dac',  '2mg — Single Vial',       60.00,   1),
  ('cjc-1295-dac',  '2mg — Kit of 10 Vials',   270.00,  2),

  ('cjc-1295',      '2mg — Single Vial',       40.00,   1),
  ('cjc-1295',      '2mg — Kit of 10 Vials',   180.00,  2),
  ('cjc-1295',      '5mg — Single Vial',       60.00,   3),
  ('cjc-1295',      '5mg — Kit of 10 Vials',   270.00,  4),
  ('cjc-1295',      '10mg — Single Vial',      100.00,  5),
  ('cjc-1295',      '10mg — Kit of 10 Vials',  450.00,  6),

  ('ipamorelin',    '2mg — Single Vial',       30.00,   1),
  ('ipamorelin',    '2mg — Kit of 10 Vials',   135.00,  2),
  ('ipamorelin',    '5mg — Single Vial',       40.00,   3),
  ('ipamorelin',    '5mg — Kit of 10 Vials',   180.00,  4),
  ('ipamorelin',    '10mg — Single Vial',      70.00,   5),
  ('ipamorelin',    '10mg — Kit of 10 Vials',  315.00,  6),

  ('hexarelin',     '2mg — Single Vial',       40.00,   1),
  ('hexarelin',     '2mg — Kit of 10 Vials',   180.00,  2),
  ('hexarelin',     '5mg — Single Vial',       80.00,   3),
  ('hexarelin',     '5mg — Kit of 10 Vials',   360.00,  4),

  ('ghrp-2',        '2mg — Single Vial',       24.00,   1),
  ('ghrp-2',        '2mg — Kit of 10 Vials',   108.00,  2),
  ('ghrp-2',        '5mg — Single Vial',       36.00,   3),
  ('ghrp-2',        '5mg — Kit of 10 Vials',   162.00,  4),

  ('hgh',           '10 IU — Single Vial',     60.00,   1),
  ('hgh',           '10 IU — Kit of 10 Vials', 270.00,  2),

  ('igf-1-lr3',     '0.1mg — Single Vial',     60.00,   1),
  ('igf-1-lr3',     '0.1mg — Kit of 10 Vials', 270.00,  2),
  ('igf-1-lr3',     '1mg — Single Vial',       240.00,  3),
  ('igf-1-lr3',     '1mg — Kit of 10 Vials',   1080.00, 4),

  ('peg-mgf',       '5mg — Single Vial',       60.00,   1),
  ('peg-mgf',       '5mg — Kit of 10 Vials',   270.00,  2),

  ('mk-677',        'Tablets — Bottle',        240.00,  1),

  -- ===== Recovery =====
  ('bpc-157',                    '2mg — Single Vial',       30.00,   1),
  ('bpc-157',                    '2mg — Kit of 10 Vials',   135.00,  2),
  ('bpc-157',                    '5mg — Single Vial',       50.00,   3),
  ('bpc-157',                    '5mg — Kit of 10 Vials',   225.00,  4),
  ('bpc-157',                    '10mg — Single Vial',      90.00,   5),
  ('bpc-157',                    '10mg — Kit of 10 Vials',  405.00,  6),

  ('thymosin-beta-4-tb-500',     '2mg — Single Vial',       50.00,   1),
  ('thymosin-beta-4-tb-500',     '2mg — Kit of 10 Vials',   225.00,  2),
  ('thymosin-beta-4-tb-500',     '5mg — Single Vial',       70.00,   3),
  ('thymosin-beta-4-tb-500',     '5mg — Kit of 10 Vials',   315.00,  4),
  ('thymosin-beta-4-tb-500',     '10mg — Single Vial',      120.00,  5),
  ('thymosin-beta-4-tb-500',     '10mg — Kit of 10 Vials',  540.00,  6),

  ('ghk-cu',                     '50mg — Single Vial',      50.00,   1),
  ('ghk-cu',                     '50mg — Kit of 10 Vials',  225.00,  2),
  ('ghk-cu',                     '100mg — Single Vial',     80.00,   3),
  ('ghk-cu',                     '100mg — Kit of 10 Vials', 360.00,  4),

  ('thymosin-alpha-1',           '5mg — Single Vial',       100.00,  1),
  ('thymosin-alpha-1',           '5mg — Kit of 10 Vials',   450.00,  2),
  ('thymosin-alpha-1',           '10mg — Single Vial',      160.00,  3),
  ('thymosin-alpha-1',           '10mg — Kit of 10 Vials',  720.00,  4),

  ('kpv',                        '10mg — Single Vial',      60.00,   1),
  ('kpv',                        '10mg — Kit of 10 Vials',  270.00,  2),

  ('thymulin',                   '10mg — Single Vial',      80.00,   1),
  ('thymulin',                   '10mg — Kit of 10 Vials',  360.00,  2),

  -- ===== Cognitive / Sleep =====
  ('semax',                      '10mg — Single Vial',      80.00,   1),
  ('semax',                      '10mg — Kit of 10 Vials',  360.00,  2),

  ('selank',                     '5mg — Single Vial',       50.00,   1),
  ('selank',                     '5mg — Kit of 10 Vials',   225.00,  2),

  ('dsip',                       '5mg — Single Vial',       80.00,   1),
  ('dsip',                       '5mg — Kit of 10 Vials',   360.00,  2),

  ('pinealon',                   '16mg — Single Vial',      80.00,   1),
  ('pinealon',                   '16mg — Kit of 10 Vials',  360.00,  2),

  -- ===== Anti-Aging =====
  ('epithalon',                  '10mg — Single Vial',      60.00,   1),
  ('epithalon',                  '10mg — Kit of 10 Vials',  270.00,  2),

  ('nad-plus',                   '500mg — Single Vial',     60.00,   1),
  ('nad-plus',                   '500mg — Kit of 10 Vials', 270.00,  2),

  ('nmn',                        'Tablets — Bottle',        120.00,  1),

  ('mots-c',                     '10mg — Single Vial',      140.00,  1),
  ('mots-c',                     '10mg — Kit of 10 Vials',  630.00,  2),

  ('ss31',                       '10mg — Single Vial',      140.00,  1),
  ('ss31',                       '10mg — Kit of 10 Vials',  630.00,  2),

  ('snap-8',                     '10mg — Single Vial',      60.00,   1),
  ('snap-8',                     '10mg — Kit of 10 Vials',  270.00,  2),

  ('pe-22-28',                   '8mg — Single Vial',       60.00,   1),
  ('pe-22-28',                   '8mg — Kit of 10 Vials',   270.00,  2),

  -- ===== Sexual Health / Fertility / Performance =====
  ('pt-141',                     '5mg — Single Vial',       50.00,   1),
  ('pt-141',                     '5mg — Kit of 10 Vials',   225.00,  2),
  ('pt-141',                     '10mg — Single Vial',      90.00,   3),
  ('pt-141',                     '10mg — Kit of 10 Vials',  405.00,  4),

  ('melanotan-2',                '10mg — Single Vial',      50.00,   1),
  ('melanotan-2',                '10mg — Kit of 10 Vials',  225.00,  2),

  ('oxytocin',                   '2mg — Single Vial',       60.00,   1),
  ('oxytocin',                   '2mg — Kit of 10 Vials',   270.00,  2),

  ('kisspeptin-10',              '5mg — Single Vial',       80.00,   1),
  ('kisspeptin-10',              '5mg — Kit of 10 Vials',   360.00,  2),

  ('hcg',                        '5000 IU — Single Vial',      80.00,   1),
  ('hcg',                        '5000 IU — Kit of 10 Vials',  360.00,  2),

  ('hmg',                        '75 IU — Single Vial',        60.00,   1),
  ('hmg',                        '75 IU — Kit of 10 Vials',    270.00,  2),

  ('fst344',                     '1mg — Single Vial',       180.00,  1),
  ('fst344',                     '1mg — Kit of 10 Vials',   810.00,  2),

  ('gdf-8',                      '1mg — Single Vial',       160.00,  1),
  ('gdf-8',                      '1mg — Kit of 10 Vials',   720.00,  2),

  ('gw501516',                   'Tablets — Bottle',        160.00,  1),
  ('slu-pp-332',                 'Tablets — Bottle',        160.00,  1),

  ('glow-blend',                 '10/10/75mg — Single Vial',        240.00,  1),
  ('glow-blend',                 '10/10/75mg — Kit of 10 Vials',    1080.00, 2),

  -- ===== Accessories =====
  ('starter-kit',                'Standard — Single Kit',           60.00,   1),
  ('starter-kit',                'Standard — Kit of 10',            270.00,  2),

  ('bac-water',                  '30ml — Single Bottle',            40.00,   1),
  ('bac-water',                  '30ml — Kit of 10 Bottles',        180.00,  2),

  ('bacteriostatic-water-3ml',   '3ml × 10 — Single Box',           10.00,   1),
  ('bacteriostatic-water-3ml',   '3ml × 10 — Kit of 10 Boxes',      45.00,   2),

  ('insulin-syringes',           '100 ct — Single Pack',            30.00,   1),
  ('insulin-syringes',           '100 ct — Kit of 10 Packs',        135.00,  2);

-- Safety net: every canonical row must resolve to a real product. Blow up
-- early if any slug is wrong so we don't half-apply the migration.
do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from tmp_canonical_variants c
  left join public.products p on p.slug = c.slug
  where p.id is null;

  if v_missing > 0 then
    raise exception 'Canonical list references % slug(s) that do not exist in public.products. Aborting.', v_missing;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Update prices + sort_order on variants that already exist.
-- -----------------------------------------------------------------------------
update public.product_variants v
set
  price       = c.price,
  sort_order  = c.sort_order,
  updated_at  = now()
from tmp_canonical_variants c
join public.products p on p.slug = c.slug
where v.product_id = p.id
  and v.variant_name = c.variant_name
  and (v.price is distinct from c.price or v.sort_order is distinct from c.sort_order);

-- -----------------------------------------------------------------------------
-- 2. Insert canonical variants that don't exist yet. Stock defaults to 999
--    to match the existing seed pattern (the site uses `inStock` boolean on
--    the product row as the real availability signal).
-- -----------------------------------------------------------------------------
insert into public.product_variants (product_id, variant_name, price, stock, sort_order)
select p.id, c.variant_name, c.price, 999, c.sort_order
from tmp_canonical_variants c
join public.products p on p.slug = c.slug
where not exists (
  select 1
  from public.product_variants v2
  where v2.product_id = p.id
    and v2.variant_name = c.variant_name
);

-- -----------------------------------------------------------------------------
-- 3. Report: anything in the DB that does not exist in the canonical list.
--    Flagged so the operator can decide whether to delete it from the admin
--    UI — we refuse to touch those rows here because order_items.variant_id
--    may still reference them.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_orphans integer := 0;
begin
  for r in
    select p.slug, p.name as product_name, v.variant_name, v.price
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join tmp_canonical_variants c
      on c.slug = p.slug and c.variant_name = v.variant_name
    where c.slug is null
    order by p.slug, v.variant_name
  loop
    v_orphans := v_orphans + 1;
    raise notice 'Orphan variant left in place: product=% (%), variant_name=%, price=%',
      r.product_name, r.slug, r.variant_name, r.price;
  end loop;

  if v_orphans = 0 then
    raise notice 'No orphan variants detected.';
  else
    raise notice 'Total orphan variants: %', v_orphans;
  end if;
end $$;

commit;
