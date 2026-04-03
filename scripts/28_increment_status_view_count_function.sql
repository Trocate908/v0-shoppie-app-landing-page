-- Function to safely increment view_count on a status
CREATE OR REPLACE FUNCTION increment_status_view_count(status_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE shop_statuses
  SET view_count = view_count + 1
  WHERE id = status_id;
$$;
