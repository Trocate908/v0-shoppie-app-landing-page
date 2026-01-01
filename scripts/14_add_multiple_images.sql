-- Add support for multiple images per product
-- Change image_url to images (JSON array)

-- Add new column for images array
ALTER TABLE public.products ADD COLUMN images JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single image_url to images array
UPDATE public.products 
SET images = jsonb_build_array(jsonb_build_object('url', image_url, 'alt', name))
WHERE image_url IS NOT NULL;

-- Keep image_url for backward compatibility temporarily
-- After migration is complete, you can drop it: ALTER TABLE public.products DROP COLUMN image_url;
