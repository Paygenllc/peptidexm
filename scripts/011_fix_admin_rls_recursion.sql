-- =========================================================
-- Fix: admin account was being treated as a customer due to
-- infinite RLS recursion on public.profiles.
-- =========================================================
-- Previous admin policies referenced public.profiles inside their USING clause
-- (e.g. `exists (select 1 from public.profiles where id = auth.uid() and is_admin)`).
-- That subquery re-triggered the same RLS policy on profiles, Supabase broke
-- the loop by returning nothing, and the is_admin() check silently evaluated
-- to false. Result: the admin dashboard fell through to the customer shell.
--
-- Fix: use a SECURITY DEFINER helper function that bypasses RLS when reading
-- the caller's own is_admin flag. The function runs with the owner's rights
-- and cannot recurse through the policy.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- profiles
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- orders
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- order_items
drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- blog_posts
drop policy if exists "Admins manage all posts" on public.blog_posts;
create policy "Admins manage all posts" on public.blog_posts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- email_broadcasts
drop policy if exists "Admins manage broadcasts" on public.email_broadcasts;
create policy "Admins manage broadcasts" on public.email_broadcasts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
