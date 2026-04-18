-- Add Zelle / payment-method tracking to orders
-- payment_method: how the customer is paying (currently always 'zelle', leaves room for stripe etc.)
-- payment_reference: the reference / confirmation # the customer sends after Zelling us
-- payment_submitted_at: when the customer submitted their reference

alter table public.orders
  add column if not exists payment_method text not null default 'zelle',
  add column if not exists payment_reference text,
  add column if not exists payment_submitted_at timestamptz;

-- Customers must be able to update their own order with the payment reference
-- (only when the order has no reference yet — they can't overwrite it).
drop policy if exists "Users can submit payment reference" on public.orders;

create policy "Users can submit payment reference"
  on public.orders
  for update
  to authenticated
  using (auth.uid() = user_id and payment_reference is null)
  with check (auth.uid() = user_id);

-- Allow lookups by order number for the public payment-reference form
-- (a guest checkout customer might not be signed in but still need to attach
-- their reference). We'll guard server-side that they know the email too.
drop policy if exists "Public can read order summary by number" on public.orders;
