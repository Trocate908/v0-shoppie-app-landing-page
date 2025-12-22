-- Fix all RLS policies to ensure proper access

-- 1. Drop existing policies on vendors
DROP POLICY IF EXISTS "Vendors manage own shop" ON public.vendors;
DROP POLICY IF EXISTS "vendors_select_own" ON public.vendors;
DROP POLICY IF EXISTS "vendors_insert_own" ON public.vendors;
DROP POLICY IF EXISTS "vendors_update_own" ON public.vendors;
DROP POLICY IF EXISTS "vendors_delete_own" ON public.vendors;

-- 2. Create proper policies for vendors table
-- Allow users to read their own vendor record
CREATE POLICY "vendors_select_own" ON public.vendors
FOR SELECT USING (auth.uid() = user_id);

-- Allow authenticated users to create their vendor record
CREATE POLICY "vendors_insert_own" ON public.vendors
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own vendor record
CREATE POLICY "vendors_update_own" ON public.vendors
FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own vendor record
CREATE POLICY "vendors_delete_own" ON public.vendors
FOR DELETE USING (auth.uid() = user_id);

-- 3. Fix locations policies
DROP POLICY IF EXISTS "Public can view locations" ON public.locations;
DROP POLICY IF EXISTS "locations_select_all" ON public.locations;
DROP POLICY IF EXISTS "locations_insert_authenticated" ON public.locations;

-- Enable RLS on locations if not already
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Anyone can read locations (for buyers)
CREATE POLICY "locations_select_all" ON public.locations
FOR SELECT USING (true);

-- Authenticated users can create locations (for vendor signup)
CREATE POLICY "locations_insert_authenticated" ON public.locations
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Fix products policies
DROP POLICY IF EXISTS "Vendors manage own products" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;

-- Anyone can view products (for buyers)
CREATE POLICY "products_select_all" ON public.products
FOR SELECT USING (true);

-- Vendors can insert their own products
CREATE POLICY "products_insert_own" ON public.products
FOR INSERT WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);

-- Vendors can update their own products
CREATE POLICY "products_update_own" ON public.products
FOR UPDATE USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);

-- Vendors can delete their own products
CREATE POLICY "products_delete_own" ON public.products
FOR DELETE USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);

-- 5. Fix product_views policies
DROP POLICY IF EXISTS "Anyone can insert product views" ON public.product_views;
DROP POLICY IF EXISTS "product_views_insert_all" ON public.product_views;
DROP POLICY IF EXISTS "product_views_select_all" ON public.product_views;

-- Enable RLS on product_views if not already
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert product views (for tracking)
CREATE POLICY "product_views_insert_all" ON public.product_views
FOR INSERT WITH CHECK (true);

-- Anyone can read product views (for analytics)
CREATE POLICY "product_views_select_all" ON public.product_views
FOR SELECT USING (true);
