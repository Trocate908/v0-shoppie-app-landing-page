-- Drop old seed data
DELETE FROM public.locations;

-- Update locations table structure (keeping existing columns for compatibility)
-- We'll use: country, market_name (as location_name), and ignore city
-- This migration makes the table work with the new simplified flow

-- Add unique constraint to prevent duplicate locations
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_country_market 
ON public.locations(country, market_name);

-- Update RLS policy for locations
DROP POLICY IF EXISTS "Public can view locations" ON public.locations;

CREATE POLICY "Public can view locations"
ON public.locations
FOR SELECT
USING (true);

-- Allow vendors to insert their own locations during signup
CREATE POLICY "Vendors can insert locations"
ON public.locations
FOR INSERT
WITH CHECK (true);
