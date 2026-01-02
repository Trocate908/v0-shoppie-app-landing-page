-- Create verification keys table
CREATE TABLE IF NOT EXISTS public.verification_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  device_fingerprint TEXT,
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add verification fields to vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS verification_key TEXT,
ADD COLUMN IF NOT EXISTS verification_activated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_device_fingerprint TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_verification_keys_code ON public.verification_keys(key_code);
CREATE INDEX IF NOT EXISTS idx_verification_keys_vendor ON public.verification_keys(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_verification_expiry ON public.vendors(verification_expires_at);

-- RLS Policies for verification_keys (admin only for now)
ALTER TABLE public.verification_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can check if key is valid"
ON public.verification_keys
FOR SELECT
USING (true);

COMMENT ON TABLE public.verification_keys IS 'Stores verification activation keys for vendors';
COMMENT ON COLUMN public.verification_keys.key_code IS '17-digit unique activation key';
COMMENT ON COLUMN public.verification_keys.is_used IS 'Whether key has been activated';
COMMENT ON COLUMN public.verification_keys.device_fingerprint IS 'Device ID to lock key to one device';
COMMENT ON COLUMN public.verification_keys.expires_at IS 'When the verification expires (1 month from activation)';
