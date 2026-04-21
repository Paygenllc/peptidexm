-- =================================================================
-- Squadco card checkout: per-order payment link & webhook tracking.
-- =================================================================
-- Mirrors the pattern we use for NOWPayments crypto orders
-- (scripts/016_nowpayments_orders.sql): keep the canonical
-- payment_status vocabulary unchanged (pending / paid / failed /
-- refunded) and capture Squadco's richer payload fields in
-- dedicated columns so the admin dashboard can surface them and
-- the webhook handler can reconcile idempotently.

alter table public.orders
  -- The "hash" is Squadco's unique slug for the payment link (e.g.
  -- https://pay.squadco.com/{hash}). It's our primary matching key
  -- when a webhook arrives, because Squadco echoes it back in the
  -- payload under `data.hash` / `meta.hash` / `transaction_ref`.
  add column if not exists squadco_hash            text,
  -- Full checkout URL we redirected the customer to. Stored mostly
  -- for support/debugging — if a customer emails saying "I never
  -- got a payment page", we can resurrect the exact link they saw.
  add column if not exists squadco_checkout_url    text,
  -- Squadco's own transaction reference for the successful charge.
  -- Populated by the webhook; empty until payment settles.
  add column if not exists squadco_transaction_ref text,
  -- Raw lifecycle status from Squadco (e.g. "success", "failed",
  -- "pending"). We translate the terminal states into our
  -- payment_status column; this column preserves the original.
  add column if not exists squadco_status          text,
  -- Amount Squadco reports having captured, in the minor unit of
  -- the charged currency (cents for USD, kobo for NGN). Compared
  -- against the order total to detect under/overpayments.
  add column if not exists squadco_amount_paid     bigint,
  -- Timestamp of the most recent webhook that touched this row.
  -- Useful for audit trails and for detecting stuck orders (link
  -- generated > N minutes ago with no webhook).
  add column if not exists squadco_updated_at      timestamptz;

-- Webhook lookups are keyed by hash first, transaction_ref second.
-- Partial indexes keep them lean — only indexed rows are ones we
-- actually sent to Squadco.
create index if not exists orders_squadco_hash_idx
  on public.orders (squadco_hash)
  where squadco_hash is not null;

create index if not exists orders_squadco_transaction_ref_idx
  on public.orders (squadco_transaction_ref)
  where squadco_transaction_ref is not null;
