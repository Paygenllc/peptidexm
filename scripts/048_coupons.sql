-- Coupon code system.
--
-- Two tables drive everything:
--   `coupons`             — the catalog of codes the admin manages.
--   `coupon_redemptions`  — one row per (coupon, order). Acts as the
--                           immutable audit trail and is the only
--                           authoritative source for "how many times
--                           has this code been used"; we mirror a
--                           denormalized count on coupons.redemption_count
--                           via the redeem function so list views don't
--                           need to JOIN to render usage.
--
-- Plus three columns on `orders` for fast joins on the order-detail
-- pages and reporting (avoid a LEFT JOIN to redemptions everywhere).
--
-- All write paths go through SECURITY DEFINER helpers so the anon
-- client at checkout can validate and redeem without RLS games on
-- the underlying tables. The tables themselves are admin-RLS only.

create table if not exists public.coupons (
  id                    uuid          primary key default gen_random_uuid(),
  -- Codes are stored upper-cased and unique. We normalize on insert
  -- via the issue/admin paths so case-insensitive lookups can use a
  -- plain `=` against the indexed column.
  code                  text          not null,
  -- "percent" → value is 0..100, applied to subtotal (pre-shipping).
  -- "fixed"   → value is dollars off the subtotal. Never reduces
  --             below zero — clamp lives in the validate helper.
  type                  text          not null check (type in ('percent', 'fixed')),
  value                 numeric(12,2) not null check (value > 0),
  -- Optional caps. Null means "no limit on that axis".
  max_uses              integer       null check (max_uses is null or max_uses > 0),
  max_per_customer      integer       null check (max_per_customer is null or max_per_customer > 0),
  min_order_subtotal    numeric(12,2) null check (min_order_subtotal is null or min_order_subtotal >= 0),
  starts_at             timestamptz   null,
  expires_at            timestamptz   null,
  active                boolean       not null default true,
  -- For codes locked to a single customer (e.g. WELCOME10-XYZ
  -- auto-issued by the newsletter popover). Null = open to anyone.
  customer_email        text          null,
  -- Free-text marker so we can tell "where did this code come from?"
  -- in the admin list. Examples: 'newsletter_welcome', 'manual', etc.
  source                text          null,
  notes                 text          null,
  redemption_count      integer       not null default 0,
  created_by            uuid          null references auth.users(id) on delete set null,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

create unique index if not exists coupons_code_key on public.coupons (upper(code));
create index if not exists coupons_active_idx on public.coupons (active) where active;
create index if not exists coupons_customer_email_idx on public.coupons (lower(customer_email)) where customer_email is not null;

create table if not exists public.coupon_redemptions (
  id                       uuid          primary key default gen_random_uuid(),
  coupon_id                uuid          not null references public.coupons(id) on delete restrict,
  order_id                 uuid          not null references public.orders(id) on delete cascade,
  email                    text          not null,
  amount_off               numeric(12,2) not null check (amount_off >= 0),
  subtotal_at_redemption   numeric(12,2) not null,
  created_at               timestamptz   not null default now()
);

-- One redemption per (coupon, order) — guards against double-credit
-- if an order replays through the place-order action (e.g. retried
-- payment).
create unique index if not exists coupon_redemptions_coupon_order_key
  on public.coupon_redemptions (coupon_id, order_id);

create index if not exists coupon_redemptions_email_idx
  on public.coupon_redemptions (lower(email));

create index if not exists coupon_redemptions_created_idx
  on public.coupon_redemptions (created_at desc);

alter table public.orders
  add column if not exists coupon_id          uuid          references public.coupons(id) on delete set null,
  add column if not exists coupon_code        text          null,
  add column if not exists coupon_amount_off  numeric(12,2) not null default 0;

create index if not exists orders_coupon_id_idx on public.orders (coupon_id) where coupon_id is not null;

-- RLS: admin-only on both tables. Public validation/redeem flows go
-- through SECURITY DEFINER functions, so the anon role never needs a
-- direct policy here.
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "coupons admin all" on public.coupons;
create policy "coupons admin all"
  on public.coupons for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "coupon_redemptions admin all" on public.coupon_redemptions;
create policy "coupon_redemptions admin all"
  on public.coupon_redemptions for all to authenticated
  using (is_admin()) with check (is_admin());

-- Auto-bump updated_at on coupon edits.
create or replace function public.tg_coupons_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
  before update on public.coupons
  for each row execute function public.tg_coupons_set_updated_at();

-- ---------------------------------------------------------------------
-- validate_coupon
-- ---------------------------------------------------------------------
-- Returns a single row with the resolved coupon and the computed
-- amount-off, or raises an exception with a stable error key the
-- client maps to a user-facing message:
--   'coupon_not_found' | 'coupon_inactive'   | 'coupon_expired'
-- | 'coupon_not_started' | 'coupon_min_order' | 'coupon_email_locked'
-- | 'coupon_max_uses_reached' | 'coupon_max_per_customer_reached'
--
-- Defined as STABLE because it never writes — the redeem function
-- below is the only path that mutates state.
-- ---------------------------------------------------------------------
create or replace function public.validate_coupon(
  p_code     text,
  p_email    text,
  p_subtotal numeric
)
returns table (
  coupon_id   uuid,
  code        text,
  type        text,
  value       numeric,
  amount_off  numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row coupons%rowtype;
  v_off numeric;
  v_uses integer;
begin
  if p_code is null or btrim(p_code) = '' then
    raise exception 'coupon_not_found';
  end if;

  select * into v_row
  from public.coupons
  where upper(code) = upper(btrim(p_code))
  limit 1;

  if not found then
    raise exception 'coupon_not_found';
  end if;

  if not v_row.active then
    raise exception 'coupon_inactive';
  end if;

  if v_row.starts_at is not null and v_row.starts_at > now() then
    raise exception 'coupon_not_started';
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    raise exception 'coupon_expired';
  end if;

  if v_row.min_order_subtotal is not null and p_subtotal < v_row.min_order_subtotal then
    raise exception 'coupon_min_order';
  end if;

  if v_row.customer_email is not null
     and (p_email is null or lower(btrim(p_email)) <> lower(v_row.customer_email))
  then
    raise exception 'coupon_email_locked';
  end if;

  -- Global cap. We compare against the denormalized counter for
  -- speed; redeem_coupon below increments it under a row lock so
  -- concurrent checkouts can't both squeeze through under the cap.
  if v_row.max_uses is not null and v_row.redemption_count >= v_row.max_uses then
    raise exception 'coupon_max_uses_reached';
  end if;

  -- Per-customer cap. Counts existing redemptions by this email.
  -- Skipped when no email was provided (we don't want to fail the
  -- preview before the visitor has typed an email).
  if v_row.max_per_customer is not null and p_email is not null and btrim(p_email) <> '' then
    select count(*) into v_uses
    from public.coupon_redemptions
    where coupon_id = v_row.id
      and lower(email) = lower(btrim(p_email));
    if v_uses >= v_row.max_per_customer then
      raise exception 'coupon_max_per_customer_reached';
    end if;
  end if;

  if v_row.type = 'percent' then
    v_off := round(p_subtotal * (v_row.value / 100.0), 2);
  else
    v_off := v_row.value;
  end if;

  -- Never discount below the subtotal — a $50 fixed code on a $30
  -- order yields $30 off, not $50. The shipping line is handled
  -- separately in the application layer.
  if v_off > p_subtotal then
    v_off := p_subtotal;
  end if;

  return query select v_row.id, v_row.code, v_row.type, v_row.value, v_off;
end;
$$;

-- ---------------------------------------------------------------------
-- redeem_coupon
-- ---------------------------------------------------------------------
-- Atomic write path called from placeOrderAction. Re-validates under
-- a row lock so two concurrent checkouts can't both blow past
-- max_uses, then inserts the redemption row and bumps the
-- denormalized counter. Idempotent on (coupon_id, order_id) — a
-- retried checkout on the same order returns the existing row.
-- ---------------------------------------------------------------------
create or replace function public.redeem_coupon(
  p_coupon_id uuid,
  p_order_id  uuid,
  p_email     text,
  p_amount_off numeric,
  p_subtotal  numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row coupons%rowtype;
  v_uses integer;
  v_redemption_id uuid;
begin
  if p_coupon_id is null or p_order_id is null then
    raise exception 'coupon_invalid_args';
  end if;

  -- Idempotency: if this order already has a redemption for this
  -- coupon, return its id and exit without touching counters.
  select id into v_redemption_id
  from public.coupon_redemptions
  where coupon_id = p_coupon_id and order_id = p_order_id
  limit 1;
  if found then
    return v_redemption_id;
  end if;

  select * into v_row from public.coupons where id = p_coupon_id for update;
  if not found then
    raise exception 'coupon_not_found';
  end if;
  if not v_row.active then
    raise exception 'coupon_inactive';
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    raise exception 'coupon_expired';
  end if;
  if v_row.max_uses is not null and v_row.redemption_count >= v_row.max_uses then
    raise exception 'coupon_max_uses_reached';
  end if;
  if v_row.max_per_customer is not null and p_email is not null and btrim(p_email) <> '' then
    select count(*) into v_uses
    from public.coupon_redemptions
    where coupon_id = v_row.id and lower(email) = lower(btrim(p_email));
    if v_uses >= v_row.max_per_customer then
      raise exception 'coupon_max_per_customer_reached';
    end if;
  end if;

  insert into public.coupon_redemptions
    (coupon_id, order_id, email, amount_off, subtotal_at_redemption)
  values
    (p_coupon_id, p_order_id, lower(btrim(p_email)), p_amount_off, p_subtotal)
  returning id into v_redemption_id;

  update public.coupons set redemption_count = redemption_count + 1 where id = p_coupon_id;

  return v_redemption_id;
end;
$$;

-- ---------------------------------------------------------------------
-- issue_welcome_coupon
-- ---------------------------------------------------------------------
-- Idempotent per (lowercased email, 'newsletter_welcome' source).
-- Returns the code regardless of whether it was just minted or
-- already existed for this email — the subscribe action will surface
-- it back to the popover so a re-subscribe still shows the user the
-- code they were originally promised.
-- ---------------------------------------------------------------------
create or replace function public.issue_welcome_coupon(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_existing text;
  v_code text;
begin
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalid';
  end if;

  -- Already minted? Reuse it. We only consider the welcome source so
  -- a manually-issued code under the same email isn't returned here.
  select code into v_existing
  from public.coupons
  where customer_email = v_email
    and source = 'newsletter_welcome'
  order by created_at desc
  limit 1;
  if found then
    return v_existing;
  end if;

  -- Generate a 6-char base32 suffix. We retry up to a handful of
  -- times if we somehow collide — base32^6 is ~1B values so this
  -- effectively never loops more than once.
  for _i in 1..6 loop
    v_code := 'WELCOME10-' || upper(substring(translate(encode(gen_random_bytes(8), 'base64'), '+/=', '') from 1 for 6));
    begin
      insert into public.coupons (
        code, type, value, max_uses, max_per_customer,
        min_order_subtotal, expires_at, customer_email, source, notes
      ) values (
        v_code, 'percent', 10, 1, 1,
        null, now() + interval '60 days', v_email, 'newsletter_welcome',
        'Auto-issued via newsletter popover'
      );
      return v_code;
    exception when unique_violation then
      -- Loop and try a new suffix.
      continue;
    end;
  end loop;

  raise exception 'coupon_code_collision';
end;
$$;

grant execute on function public.validate_coupon(text, text, numeric) to anon, authenticated;
grant execute on function public.redeem_coupon(uuid, uuid, text, numeric, numeric) to anon, authenticated;
grant execute on function public.issue_welcome_coupon(text) to anon, authenticated;
