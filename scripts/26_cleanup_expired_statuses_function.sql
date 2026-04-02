-- Function: cleanup_expired_statuses
-- Deletes rows from shop_statuses that have passed their expires_at time.
-- Storage file deletion is handled by the Next.js API route (service role required).
-- This function is called by the API route after it has already deleted the storage files.

CREATE OR REPLACE FUNCTION public.cleanup_expired_statuses()
RETURNS TABLE(deleted_count integer, deleted_ids uuid[], deleted_media_urls text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids      uuid[];
  v_urls     text[];
  v_count    integer;
BEGIN
  -- Collect expired rows
  SELECT
    array_agg(id),
    array_agg(media_url),
    count(*)::integer
  INTO v_ids, v_urls, v_count
  FROM public.shop_statuses
  WHERE expires_at < now();

  -- Delete expired rows
  DELETE FROM public.shop_statuses
  WHERE expires_at < now();

  -- Return what was deleted so the caller can purge storage
  RETURN QUERY SELECT v_count, v_ids, v_urls;
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_statuses() TO service_role;
