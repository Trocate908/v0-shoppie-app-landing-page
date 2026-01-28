-- Create locations table
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  city text not null,
  market_name text not null,
  created_at timestamp with time zone default now()
);

-- Create index for faster queries
create index if not exists idx_locations_market on public.locations(country, city, market_name);

-- Enable RLS
alter table public.locations enable row level security;

-- Allow public read access for buyers
create policy "Public can view locations"
on public.locations
for select
using (true);
