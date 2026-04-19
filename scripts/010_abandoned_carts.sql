-- Abandoned-cart recovery: one row per unrecovered cart, keyed by email.
-- We capture the shopper's cart + contact info as soon as they provide an
-- email on the checkout step, so when they leave without completing, the
-- reminder cron has something to send. Recovered rows are kept for
-- analytics (so we can attribute revenue) but ignored by the cron.

create extension if not exists "pgcrypto";

create table if not exists public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),

  -- Contact snapshot at the moment we captured the cart. Normalized to
  -- lowercase in the app layer so a typo in casing doesn't create two
  -- separate rows for the same person.
  email text not null,
  first_name text,
  last_name text,
  phone text,

  -- Guest vs. authenticated: capture both so account-linked carts can
  -- show up on the admin customer page down the road.
  user_id uuid references auth.users(id) on delete set null,

  -- Deep-link token baked into the "Complete your order" CTA. Unique so
  -- one cart can't be resurrected from two different links, and random
  -- enough that it can't be guessed from a leaked email.
  token text not null unique,

  -- Cart payload. Mirrors the `CartItem[]` shape the client context uses
  -- so the recovery page can drop it back into localStorage unchanged.
  items jsonb not null,
  subtotal numeric(10,2) not null default 0,

  -- Reminder bookkeeping. `reminder_count` is incremented each send; the
  -- cron caps it at 2 so we don't spam. `last_reminder_sent_at` is what
  -- the cron filters on to space reminders apart by tier.
  reminder_count integer not null default 0,
  last_reminder_sent_at timestamptz,

  -- When set, the cart was completed — either by placeOrderAction firing
  -- for the same email, or by an admin manually marking it. The cron
  -- always excludes recovered rows.
  recovered_at timestamptz,
  recovered_order_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Touch updated_at on every write so the cron can use it to decide
-- abandonment age.
create or replace function public.tg_abandoned_carts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists abandoned_carts_updated_at on public.abandoned_carts;
create trigger abandoned_carts_updated_at
before update on public.abandoned_carts
for each row execute function public.tg_abandoned_carts_updated_at();

-- One OPEN cart per email. Recovered rows are allowed to coexist
-- alongside a new open cart (so repeat abandoners don't collide).
create unique index if not exists abandoned_carts_email_open_unique
  on public.abandoned_carts (lower(email))
  where recovered_at is null;

-- Cron filter path: unrecovered + sorted by oldest activity.
create index if not exists abandoned_carts_cron_idx
  on public.abandoned_carts (updated_at)
  where recovered_at is null;

-- Admin listing default sort.
create index if not exists abandoned_carts_created_idx
  on public.abandoned_carts (created_at desc);

-- Lock the table down: every access goes through the service-role admin
-- client (server actions + cron route). No client-side reads, no direct
-- RLS-governed access. Matches how orders are inserted today.
alter table public.abandoned_carts enable row level security;

-- Explicitly no policies → everything through service role.
-- (Leaving this commented block here so future maintainers see the
--  intentional choice rather than thinking a policy was forgotten.)
-- -- create policy ... on public.abandoned_carts for ... ;
