-- Add verification fields to vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_documents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Add index for verified vendors
CREATE INDEX IF NOT EXISTS idx_vendors_verified ON public.vendors(is_verified);

-- Update existing vendors to have default verification status
UPDATE public.vendors SET verification_status = 'unverified' WHERE verification_status IS NULL;

COMMENT ON COLUMN public.vendors.is_verified IS 'Whether the vendor has been verified';
COMMENT ON COLUMN public.vendors.verification_status IS 'Current verification status: unverified, pending, verified, rejected';
COMMENT ON COLUMN public.vendors.verification_requested_at IS 'When verification was requested';
COMMENT ON COLUMN public.vendors.verification_documents IS 'Array of document URLs uploaded for verification';
COMMENT ON COLUMN public.vendors.verification_notes IS 'Admin notes or vendor notes about verification';
