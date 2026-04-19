-- Payment-reminder tracking for orders that were placed but haven't been
-- paid yet. Lets us enforce a send cadence (nudge after 2h, final at 24h)
-- and surface "how many times have we emailed this customer?" on the
-- admin detail page. Both columns are optional so old rows stay valid.
--
-- Partial index keeps the cron query cheap — we only ever scan pending
-- orders that haven't been cancelled/refunded/paid, which is a tiny
-- slice of the full orders table.

alter table public.orders
  add column if not exists payment_reminder_count integer not null default 0;

alter table public.orders
  add column if not exists last_payment_reminder_sent_at timestamptz;

create index if not exists orders_payment_pending_cron_idx
  on public.orders (created_at)
  where payment_status = 'pending' and status not in ('cancelled', 'refunded');
