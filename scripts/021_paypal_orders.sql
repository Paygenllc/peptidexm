-- 021_paypal_orders.sql
-- Adds PayPal-specific reconciliation columns to public.orders and
-- registers the payment_paypal_enabled admin toggle in site_settings.
--
-- Flow (redirect mode):
--   1. Customer picks PayPal at checkout.
--   2. We call /v2/checkout/orders on PayPal's REST API, get back a
--      PayPal order_id and an approve URL. Both are stored on the row
--      so we can reconcile on return (no webhook required).
--   3. Customer is redirected to the approve URL and authorizes.
--   4. PayPal sends them back to our return URL with ?token=<order_id>.
--      We call /v2/checkout/orders/{id}/capture, inspect the capture
--      status, and mark the order paid.
--
-- The partial index keeps verify-on-return lookups O(log n) without
-- bloating the orders table for Zelle/Crypto/Card rows.

insert into public.site_settings (key, value)
values ('payment_paypal_enabled', to_jsonb(false))
on conflict (key) do nothing;

alter table public.orders
  add column if not exists paypal_order_id       text,
  add column if not exists paypal_capture_id     text,
  add column if not exists paypal_status         text,
  add column if not exists paypal_amount_paid    bigint,
  add column if not exists paypal_approve_url    text,
  add column if not exists paypal_updated_at     timestamptz;

create index if not exists orders_paypal_order_id_idx
  on public.orders (paypal_order_id)
  where paypal_order_id is not null;
