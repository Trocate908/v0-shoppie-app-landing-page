-- =====================================================================
-- ShoppieApp — Notification System (FIX)
--
-- Fixes the get_trending_products() function so it works no matter what
-- shape the products.image_urls / image_url columns are. Run AFTER
-- 001_notifications_setup.sql (or instead of it if 001 failed midway).
--
-- Safe to re-run.
-- =====================================================================

DROP FUNCTION IF EXISTS public.get_trending_products(INT);

CREATE OR REPLACE FUNCTION public.get_trending_products(limit_count INT DEFAULT 5)
RETURNS TABLE (
  product_id   UUID,
  product_name TEXT,
  image_url    TEXT,
  view_count   BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Use to_jsonb() so we can safely read whatever image-ish column exists
  -- (image_url, image_urls, images, photo_url, ...) without crashing if
  -- one of them isn't present or is a JSON array.
  RETURN QUERY
  SELECT
    p.id                                     AS product_id,
    COALESCE(
      NULLIF(to_jsonb(p)->>'name', ''),
      NULLIF(to_jsonb(p)->>'title', ''),
      'a product'
    )                                        AS product_name,
    COALESCE(
      NULLIF(to_jsonb(p)->>'image_url', ''),
      NULLIF(to_jsonb(p)->>'thumbnail_url', ''),
      NULLIF(to_jsonb(p)->>'photo_url', ''),
      NULLIF(to_jsonb(p)->'image_urls'->>0, ''),
      NULLIF(to_jsonb(p)->'images'->>0, '')
    )                                        AS image_url,
    COUNT(pv.id)                             AS view_count
  FROM public.products p
  LEFT JOIN public.product_views pv
    ON pv.product_id = p.id
   AND pv.viewed_at >= NOW() - INTERVAL '7 days'
  GROUP BY p.id
  HAVING COUNT(pv.id) > 0
  ORDER BY COUNT(pv.id) DESC
  LIMIT limit_count;
END;
$$;

-- Sanity check
SELECT * FROM public.get_trending_products(5);
