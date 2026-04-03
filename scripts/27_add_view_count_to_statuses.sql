-- Add view_count column to shop_statuses table
ALTER TABLE public.shop_statuses
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Allow anyone to increment view_count (public update, only on that column)
CREATE POLICY "Anyone can increment view count"
  ON public.shop_statuses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
