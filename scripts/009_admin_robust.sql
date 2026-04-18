-- 009 · Admin-robust upgrade
-- Adds user management flags, email broadcast tables, and blog CMS tables.

-- ------------------------------------------------------------
-- 1. User management extras on profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists newsletter_subscribed boolean not null default true,
  add column if not exists last_seen_at timestamptz;

-- ------------------------------------------------------------
-- 2. Email broadcasts
-- ------------------------------------------------------------
create table if not exists public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  preview text,
  body_markdown text not null,
  audience text not null default 'subscribers', -- 'subscribers' | 'all_customers' | 'admins'
  status text not null default 'draft',         -- 'draft' | 'sending' | 'sent' | 'failed'
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_broadcasts_created_at_idx
  on public.email_broadcasts (created_at desc);

alter table public.email_broadcasts enable row level security;

drop policy if exists "Admins manage broadcasts" on public.email_broadcasts;
create policy "Admins manage broadcasts" on public.email_broadcasts
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ------------------------------------------------------------
-- 3. Blog posts
-- ------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content_markdown text not null,
  cover_image_url text,
  tags text[] not null default '{}',
  status text not null default 'draft',  -- 'draft' | 'published'
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_published_idx
  on public.blog_posts (status, published_at desc);

create index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published posts" on public.blog_posts;
create policy "Public can read published posts" on public.blog_posts
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Admins manage all posts" on public.blog_posts;
create policy "Admins manage all posts" on public.blog_posts
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at
  before update on public.blog_posts
  for each row execute function public.touch_updated_at();
