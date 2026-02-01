-- Allow public (buyers) to read vendor information
-- This is needed so buyers can see products from vendors in their selected location

CREATE POLICY "Public can view vendors"
ON public.vendors
FOR SELECT
USING (true);

-- Also ensure public can read vendor products
CREATE POLICY "Public can view all products"
ON public.products
FOR SELECT
USING (true);
