-- Drop the overly broad "Anyone can increment view count" UPDATE policy
DROP POLICY IF EXISTS "Anyone can increment view count" ON public.shop_statuses;

-- Add a specific policy allowing ONLY vendors to update their own statuses (for caption/text edits)
CREATE POLICY "Vendors can update own statuses"
  ON public.shop_statuses
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
    )
  );

-- Re-create the view count increment as SECURITY DEFINER function only (no RLS policy needed)
-- The increment_status_view_count function already uses SECURITY DEFINER so it bypasses RLS.
-- No additional policy required for view count increments.
