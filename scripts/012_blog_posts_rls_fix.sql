-- Fix blog_posts RLS: create the is_admin() helper and proper policies
-- This script was already executed on 2024-XX-XX; kept here for reference.

-- Create is_admin() helper as SECURITY DEFINER so it can bypass RLS to check profiles
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Grant execute to authenticated users
grant execute on function public.is_admin() to authenticated;

-- Drop any existing policies on blog_posts (clean slate)
drop policy if exists "Admins manage all posts" on public.blog_posts;
drop policy if exists "Public can read published posts" on public.blog_posts;
drop policy if exists "blog_posts_admin_all" on public.blog_posts;
drop policy if exists "blog_posts_public_read" on public.blog_posts;

-- Create admin policy for all operations (SELECT, INSERT, UPDATE, DELETE)
create policy "blog_posts_admin_all"
on public.blog_posts
for all
to authenticated
using (is_admin())
with check (is_admin());

-- Create public read policy for published posts
create policy "blog_posts_public_read"
on public.blog_posts
for select
to anon, authenticated
using (status = 'published');
