-- Stryd Pay reconciliation columns on `orders`.
--
-- Mirrors the squadco_* shape so admin queries and reporting code can
-- treat both processors uniformly. We keep the columns on `orders`
-- (rather than a side table) because:
--   1. The "active card processor" can flip at any time, but a single
--      order is always tied to exactly one processor at placement
--      time. Either squadco_* or stryd_* will be populated, never
--      both — so the row stays sparse but unambiguous.
--   2. Admin order detail views render reconciliation info inline; a
--      join would force an extra round-trip on every order load.
--
-- Stryd amounts are returned in DOLLARS (not cents), so the columns
-- are `numeric(12,2)` instead of bigint like squadco_amount_paid.

alter table public.orders
  add column if not exists stryd_tx_ref         text,
  add column if not exists stryd_status         text,
  add column if not exists stryd_checkout_url   text,
  add column if not exists stryd_redirect_url   text,
  add column if not exists stryd_amount_paid    numeric(12,2),
  add column if not exists stryd_fee_amount     numeric(12,2),
  add column if not exists stryd_net_amount     numeric(12,2),
  add column if not exists stryd_paid_at        timestamptz,
  add column if not exists stryd_updated_at     timestamptz;

-- Same lookup pattern as orders_squadco_hash_idx (migration 019):
-- the webhook handler matches incoming events to orders by tx_ref,
-- so we want a B-tree on it for O(log n) lookups even with millions
-- of orders.
create index if not exists orders_stryd_tx_ref_idx
  on public.orders (stryd_tx_ref)
  where stryd_tx_ref is not null;

-- Active card processor selector. Stored as a JSONB string so we can
-- reuse the existing `site_settings (key text pk, value jsonb)` table
-- and the existing `getSetting`/`setPaymentMethodEnabledAction`-style
-- read/write paths without inventing a new column type.
--
-- We default to 'squadco' to preserve current behavior for any existing
-- deploy that hasn't seen this migration yet — the customer-facing
-- 'card' rail keeps routing to Squadco until an admin explicitly flips
-- it to 'stryd' from the admin UI.
insert into public.site_settings (key, value)
values ('card_processor', '"squadco"'::jsonb)
on conflict (key) do nothing;
