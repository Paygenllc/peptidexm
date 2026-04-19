-- =================================================================
-- NOWPayments crypto checkout: per-order invoice & payment tracking.
-- =================================================================
-- We keep our existing payment_status vocabulary unchanged
-- (pending / paid / failed / refunded) and store NOWPayments'
-- richer lifecycle status in a dedicated column so the admin can
-- see "waiting", "confirming", "partially_paid" etc. without us
-- needing to loosen the CHECK constraint.

alter table public.orders
  add column if not exists nowpayments_invoice_id   text,
  add column if not exists nowpayments_invoice_url  text,
  add column if not exists nowpayments_payment_id   text,
  add column if not exists nowpayments_status       text,
  add column if not exists nowpayments_pay_currency text,
  add column if not exists nowpayments_pay_amount   numeric(20, 8),
  add column if not exists nowpayments_actually_paid numeric(20, 8),
  add column if not exists nowpayments_updated_at   timestamptz;

-- Payment lookups during the IPN handler must be fast.
create index if not exists orders_nowpayments_invoice_id_idx
  on public.orders (nowpayments_invoice_id)
  where nowpayments_invoice_id is not null;

create index if not exists orders_nowpayments_payment_id_idx
  on public.orders (nowpayments_payment_id)
  where nowpayments_payment_id is not null;
