-- 018 — Blog view counts and order traffic-source attribution.
--
-- Two unrelated admin-surfaced metrics bundled together because they're
-- both tiny column-adds driven by the same product ask.
--
-- 1. blog_posts.view_count + increment_blog_view() RPC so anon can bump
--    the counter atomically without needing a writeable RLS policy.
-- 2. orders.referrer / landing_path / source_channel / utm_* so the
--    admin can see where each order's buyer came from (direct, organic,
--    social, referral, paid, email, internal).
--
-- All statements are idempotent (`IF NOT EXISTS` / `OR REPLACE`) so the
-- migration is safe to re-run.

-- -----------------------------------------------------------------------
-- 1. Blog view counts
-- -----------------------------------------------------------------------
alter table public.blog_posts
  add column if not exists view_count integer not null default 0;

-- Atomic counter bump by slug. SECURITY DEFINER so anonymous visitors
-- (who cannot UPDATE blog_posts directly) can still increment the
-- counter via the API — the function only touches the one column, so
-- there's no privilege escalation surface.
create or replace function public.increment_blog_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.blog_posts
     set view_count = view_count + 1
   where slug = p_slug
     and status = 'published';
end;
$$;

-- Lock execution down. Both roles used by the app need it: anon for
-- unauthenticated visitors, authenticated for logged-in customers.
revoke all on function public.increment_blog_view(text) from public;
grant execute on function public.increment_blog_view(text) to anon, authenticated;

-- -----------------------------------------------------------------------
-- 2. Order traffic-source attribution
-- -----------------------------------------------------------------------
-- referrer       = document.referrer captured at landing
-- landing_path   = path of the first page the buyer visited in this session
-- source_channel = classified bucket: direct | organic | social | referral
--                                   | paid | email | internal | unknown
-- utm_*          = first-touch UTM params, if any were on the landing URL
alter table public.orders
  add column if not exists referrer text,
  add column if not exists landing_path text,
  add column if not exists source_channel text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text;

-- One cheap index for the most common filter — "show me all orders from
-- <channel>" — without committing to any heavier reporting schema yet.
create index if not exists orders_source_channel_idx
  on public.orders (source_channel)
  where source_channel is not null;
