-- Add WhatsApp number field to vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Add comment to describe the column
COMMENT ON COLUMN public.vendors.whatsapp_number IS 'Vendor WhatsApp number for buyer contact';
