-- Site-wide key/value settings.
--
-- Purpose
--   Small table for operator-tunable flags that shouldn't require a
--   deploy to change. First use case is the payment-method on/off
--   toggles ("card_enabled", "zelle_enabled", "crypto_enabled") but
--   this is intentionally generic so future flags (free_shipping,
--   maintenance_mode, etc.) can live here without another migration.
--
-- Design choices
--   - TEXT keys (snake_case) over an enum so adding a new flag is just
--     an insert — no `ALTER TYPE` required.
--   - JSONB value so the same table can hold booleans, numbers, or
--     small configs without a widening migration later.
--   - Small enough that a seq scan is fine; no indexes beyond the PK.
--
-- RLS
--   Read access is wide open — the public checkout page reads these
--   flags to decide which payment tiles to render. Writes are locked
--   to the service role, which is what the admin server actions use.

create table if not exists public.site_settings (
  key         text        primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        null
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings read (public)" on public.site_settings;
create policy "site_settings read (public)"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

-- Seed the three payment-method flags so the admin UI has rows to
-- toggle on first load. Existing rows are left alone. Default to
-- `true` so the checkout page works out of the box on fresh envs.
insert into public.site_settings (key, value)
values
  ('payment_card_enabled',   to_jsonb(true)),
  ('payment_zelle_enabled',  to_jsonb(true)),
  ('payment_crypto_enabled', to_jsonb(true))
on conflict (key) do nothing;
