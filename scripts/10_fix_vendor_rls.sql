-- Fix RLS policies for vendors table to allow proper access

-- First, drop existing policy if it exists
DROP POLICY IF EXISTS "Vendors manage own shop" ON public.vendors;

-- Create separate policies for different operations
-- Allow vendors to SELECT their own record
CREATE POLICY "Vendors can view own shop"
ON public.vendors
FOR SELECT
USING (auth.uid() = user_id);

-- Allow vendors to INSERT their own record
CREATE POLICY "Vendors can create shop"
ON public.vendors
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow vendors to UPDATE their own record
CREATE POLICY "Vendors can update own shop"
ON public.vendors
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow vendors to DELETE their own record (if needed)
CREATE POLICY "Vendors can delete own shop"
ON public.vendors
FOR DELETE
USING (auth.uid() = user_id);

-- Fix product_views table to allow SELECT for counting
DROP POLICY IF EXISTS "Anyone can view product views" ON public.product_views;
CREATE POLICY "Anyone can view product views"
ON public.product_views
FOR SELECT
USING (true);
