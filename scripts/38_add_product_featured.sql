-- 38_add_product_featured.sql
-- Adds an optional promotion/featured flag to products so the homepage
-- "Featured" carousel can promote specific listings.
--
-- Safe to run at any time: the app treats the column as optional and falls
-- back to verified-vendor products when the column is absent or has no
-- flagged rows.

alter table public.products
  add column if not exists is_featured boolean not null default false;

-- Partial index so the homepage query for featured products stays fast.
create index if not exists products_is_featured_idx
  on public.products (is_featured)
  where is_featured = true;

-- Vendors manage their own products (matches existing RLS model).
-- Anonymous/authenticated users read products already; no new read policy
-- is required because this column rides on the existing products rows.
