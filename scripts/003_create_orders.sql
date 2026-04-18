-- Orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  status text not null default 'pending',
  -- status: pending, processing, shipped, delivered, cancelled, refunded

  -- Customer info
  email text not null,
  phone text,
  first_name text not null,
  last_name text not null,

  -- Shipping address
  address text not null,
  address2 text,
  city text not null,
  state text not null,
  zip_code text not null,
  country text not null,

  -- Payment
  payment_method text,
  payment_status text not null default 'pending',
  -- payment_status: pending, paid, failed, refunded

  -- Totals
  subtotal numeric(10, 2) not null,
  shipping_cost numeric(10, 2) not null default 0,
  tax numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,

  -- Tracking
  tracking_number text,
  tracking_carrier text,
  notes text,
  admin_notes text,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shipped_at timestamptz,
  delivered_at timestamptz
);

-- Order items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  -- Snapshot of product info at time of order
  product_name text not null,
  variant_name text not null,
  image_url text,
  unit_price numeric(10, 2) not null,
  quantity integer not null,
  subtotal numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_email on public.orders(email);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);

-- Enable RLS
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Public can insert orders (guest checkout)
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
  for insert with check (true);

drop policy if exists "order_items_public_insert" on public.order_items;
create policy "order_items_public_insert" on public.order_items
  for insert with check (true);

-- Admins can do everything
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

drop trigger if exists variants_updated_at on public.product_variants;
create trigger variants_updated_at
  before update on public.product_variants
  for each row execute function public.handle_updated_at();
