-- ============================================================
-- 010: Fix admin customer visibility + user order visibility
-- ============================================================
-- Prior to this migration:
--   * /admin/customers returned only the admin's own row because
--     public.profiles only had owner-scoped RLS policies.
--   * /account showed no orders for users who placed guest orders
--     before their account existed, because public.orders only
--     had a strict user_id = auth.uid() policy.
--
-- This migration:
--   1. Adds admin SELECT + UPDATE policies on profiles.
--   2. Adds admin ALL policies on orders and order_items so the
--      admin detail pages (which use the session client subject
--      to RLS) can read/write every row.
--   3. Adds user SELECT-by-email policies on orders/order_items
--      as a belt-and-suspenders fallback.
--   4. Installs an auth.users INSERT trigger that automatically
--      links any matching guest orders to a new signup.
--   5. Backfills existing orphan orders by matching email.
-- ============================================================

-- 1) Admin SELECT policy for profiles
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 2) Admin UPDATE policy for profiles
drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 3) Admin ALL policy for orders & order_items
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 4) User SELECT-by-email fallback for orders & order_items
drop policy if exists "orders_user_by_email" on public.orders;
create policy "orders_user_by_email" on public.orders
  for select to authenticated
  using (lower(email) = lower((select u.email from auth.users u where u.id = auth.uid())));

drop policy if exists "order_items_user_by_email" on public.order_items;
create policy "order_items_user_by_email" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and lower(o.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
    )
  );

-- 5) Link future guest orders to new signups by email
create or replace function public.link_guest_orders_to_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update public.orders
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_link_orders on auth.users;
create trigger on_auth_user_created_link_orders
  after insert on auth.users
  for each row execute function public.link_guest_orders_to_new_user();

-- 6) One-time backfill
update public.orders o
   set user_id = u.id
  from auth.users u
 where o.user_id is null
   and lower(o.email) = lower(u.email);
