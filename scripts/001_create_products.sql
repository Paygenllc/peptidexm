-- Products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  category text,
  image_url text,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Product variants table (for different sizes/dosages)
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null,
  price numeric(10, 2) not null,
  stock integer not null default 0,
  sku text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_active on public.products(active);

-- Enable RLS
alter table public.products enable row level security;
alter table public.product_variants enable row level security;

-- Public can read active products
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (active = true);

drop policy if exists "variants_public_read" on public.product_variants;
create policy "variants_public_read" on public.product_variants
  for select using (true);

-- Admins can do everything
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

drop policy if exists "variants_admin_all" on public.product_variants;
create policy "variants_admin_all" on public.product_variants
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );
