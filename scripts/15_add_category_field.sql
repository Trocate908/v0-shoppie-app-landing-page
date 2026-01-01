-- Add category field to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT;

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- Update existing products to have a default category
UPDATE public.products SET category = 'Other' WHERE category IS NULL;
