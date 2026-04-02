-- Create shop_statuses table
-- Statuses expire after 24 hours
-- Unverified shops: visible only to followers (future feature, currently all visible)
-- Verified shops: visible to everyone

CREATE TABLE IF NOT EXISTS public.shop_statuses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'text')),
  text_content text,
  caption text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + interval '24 hours') NOT NULL
);

-- Index for quick lookups by vendor and expiry
CREATE INDEX IF NOT EXISTS idx_shop_statuses_vendor_id ON public.shop_statuses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shop_statuses_expires_at ON public.shop_statuses(expires_at);

-- RLS
ALTER TABLE public.shop_statuses ENABLE ROW LEVEL SECURITY;

-- Verified vendor statuses are public; unverified are visible to all for now
-- (follower-gating can be layered in a future migration)
CREATE POLICY "Anyone can view active statuses"
  ON public.shop_statuses
  FOR SELECT
  USING (expires_at > now());

-- Only the owning vendor can insert
CREATE POLICY "Vendors can insert own statuses"
  ON public.shop_statuses
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
    )
  );

-- Only the owning vendor can delete
CREATE POLICY "Vendors can delete own statuses"
  ON public.shop_statuses
  FOR DELETE
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
    )
  );
