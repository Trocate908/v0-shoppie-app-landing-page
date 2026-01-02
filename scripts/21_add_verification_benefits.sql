-- Add buyer protection documentation and analytics tracking

-- Create table to track verified vendor performance for sales growth metrics
CREATE TABLE IF NOT EXISTS public.verified_vendor_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  views_before_verification INTEGER DEFAULT 0,
  views_after_verification INTEGER DEFAULT 0,
  inquiries_before INTEGER DEFAULT 0,
  inquiries_after INTEGER DEFAULT 0,
  verification_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on verified vendor stats
ALTER TABLE public.verified_vendor_stats ENABLE ROW LEVEL SECURITY;

-- Allow vendors to view their own stats
CREATE POLICY "Vendors can view own stats"
ON public.verified_vendor_stats
FOR SELECT
USING (auth.uid() = (SELECT user_id FROM public.vendors WHERE id = vendor_id));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_verified_vendor_stats_vendor_id 
ON public.verified_vendor_stats(vendor_id);

-- Add comment explaining buyer protection
COMMENT ON COLUMN public.vendors.is_verified IS 'Verified vendors receive: Priority visibility, buyer protection guarantee, trust badge, and sales growth benefits';
