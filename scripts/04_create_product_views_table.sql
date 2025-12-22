-- Create product_views table
create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  viewed_at timestamp with time zone default now()
);

-- Create index for faster queries
create index if not exists idx_product_views_product_id on public.product_views(product_id);

-- Enable RLS
alter table public.product_views enable row level security;

-- Anyone can insert product views
create policy "Anyone can insert product views"
on public.product_views
for insert
with check (true);
