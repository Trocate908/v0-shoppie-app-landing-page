-- Create storage bucket for product images
-- This must be run manually via Supabase dashboard or use the storage API

-- Insert bucket (if running via SQL editor)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Allow public read access to product images
create policy "Public can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

-- Allow vendors to upload their own product images
create policy "Vendors can upload product images"
on storage.objects for insert
with check (
  bucket_id = 'product-images' and
  (storage.foldername(name))[1] in (
    select id::text from public.vendors where user_id = auth.uid()
  )
);

-- Allow vendors to delete their own product images
create policy "Vendors can delete own product images"
on storage.objects for delete
using (
  bucket_id = 'product-images' and
  (storage.foldername(name))[1] in (
    select id::text from public.vendors where user_id = auth.uid()
  )
);
