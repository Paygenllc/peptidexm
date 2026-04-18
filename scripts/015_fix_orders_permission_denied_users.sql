-- =================================================================
-- Fix: "permission denied for table users" on /admin/orders
-- =================================================================
-- The orders_user_by_email and order_items_user_by_email policies
-- (added in 010) referenced auth.users directly in their USING
-- clauses. The `authenticated` role has no SELECT on auth.users, so
-- Postgres aborted every read against orders / order_items during
-- policy evaluation with "permission denied for table users" —
-- even for admins, because RLS evaluates the union of all policies.
--
-- Fix: route the email lookup through a SECURITY DEFINER helper
-- (same pattern as public.is_admin()) so the catalog read runs with
-- the function owner's privileges and the policies themselves don't
-- need auth.users access.

create or replace function public.current_user_email()
returns text
language sql
security definer
stable
set search_path = public, auth
as $$
  select lower(u.email::text) from auth.users u where u.id = auth.uid();
$$;

grant execute on function public.current_user_email() to authenticated, anon;

drop policy if exists "orders_user_by_email" on public.orders;
create policy "orders_user_by_email" on public.orders
  for select to authenticated
  using (lower(email) = public.current_user_email());

drop policy if exists "order_items_user_by_email" on public.order_items;
create policy "order_items_user_by_email" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and lower(o.email) = public.current_user_email()
    )
  );
