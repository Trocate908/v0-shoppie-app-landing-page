-- Create products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  in_stock boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for faster queries
create index if not exists idx_products_vendor_id on public.products(vendor_id);
create index if not exists idx_products_name on public.products(name);

-- Enable RLS
alter table public.products enable row level security;

-- Vendors manage only their products
create policy "Vendors manage own products"
on public.products
for all
using (
  vendor_id in (
    select id from public.vendors where user_id = auth.uid()
  )
);

-- Allow public read access for buyers
create policy "Public can view products"
on public.products
for select
using (true);
