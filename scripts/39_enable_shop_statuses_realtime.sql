-- Enable Realtime on shop_statuses so the Store tab's "Shop Updates" feed
-- receives new posts without a manual refetch.
--
-- Until this runs, the client-side channel in components/status-row.tsx never
-- fires and the tab-focus refetch remains the fallback, so the feature is
-- safe to deploy ahead of this migration.

-- Create the publication if it doesn't exist (Supabase creates it by default,
-- but a self-hosted instance may not have it).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add the table to the publication. `DROP ... IF EXISTS` first so this script
-- is safe to re-run without erroring on an existing membership.
ALTER PUBLICATION supabase_realtime DROP TABLE public.shop_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_statuses;

-- Confirm it took effect.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shop_statuses'
  ) THEN
    RAISE NOTICE 'shop_statuses is now in the supabase_realtime publication';
  ELSE
    RAISE EXCEPTION 'failed to add shop_statuses to supabase_realtime';
  END IF;
END
$$;
