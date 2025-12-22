-- Create vendors table
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  shop_name text not null,
  shop_description text,
  is_open boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.vendors enable row level security;

-- Vendors can manage only their own shop
create policy "Vendors manage own shop"
on public.vendors
for all
using (auth.uid() = user_id);
