-- Add support for multiple images for verified vendors
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]';

-- Update existing products to have image_urls array from image_url
UPDATE products 
SET image_urls = CASE 
  WHEN image_url IS NOT NULL THEN jsonb_build_array(image_url)
  ELSE '[]'::jsonb
END
WHERE image_urls = '[]'::jsonb OR image_urls IS NULL;

COMMENT ON COLUMN products.image_urls IS 'Array of image URLs - verified vendors can have up to 3 images';
COMMENT ON COLUMN products.image_url IS 'Primary image URL - kept for backward compatibility';
