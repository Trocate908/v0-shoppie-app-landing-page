-- =====================================================================
-- ShoppieApp — Notification System
-- Run this on your Supabase project.
--
-- Fully idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE
-- / DROP IF EXISTS. Safe to run any number of times.
-- =====================================================================

-- ───────────────────────────────────────────────────────────────────────
-- 1) FCM device tokens
--    Stores Firebase Cloud Messaging tokens per device.
--    A user (or anonymous shopper) may have multiple devices.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id       TEXT,
  token           TEXT NOT NULL UNIQUE,
  user_agent      TEXT,
  user_type       TEXT NOT NULL DEFAULT 'shopper'
                  CHECK (user_type IN ('vendor', 'shopper', 'anonymous')),
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id    ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_id  ON public.push_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_type  ON public.push_tokens(user_type);
CREATE INDEX IF NOT EXISTS idx_push_tokens_enabled    ON public.push_tokens(enabled) WHERE enabled = TRUE;

-- ───────────────────────────────────────────────────────────────────────
-- 2) Notifications (in-app inbox, mirrors what's pushed via FCM)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     TEXT,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  link          TEXT,
  image_url     TEXT,
  metadata      JSONB,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_device_id   ON public.notifications(device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread      ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type        ON public.notifications(type);

-- ───────────────────────────────────────────────────────────────────────
-- 3) Engagement send log (dedupe across cron runs)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_sends (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,
  device_id    TEXT,
  type         TEXT NOT NULL,
  ref_id       TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_sends_lookup
  ON public.notification_sends(user_id, type, ref_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_sends_device
  ON public.notification_sends(device_id, type, sent_at DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 4) Row Level Security
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_update_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own"  ON public.push_tokens;

CREATE POLICY "push_tokens_select_own"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "push_tokens_update_own"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "push_tokens_delete_own"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_sends has no policies — service role only.

-- ───────────────────────────────────────────────────────────────────────
-- 5) Helper: trending products (last 7 days by view count)
--    Schema-agnostic: works whether the products table uses image_url,
--    image_urls (jsonb array or text array), images, photo_url, etc.
--    Falls back to recent products if product_views table doesn't exist.
-- ───────────────────────────────────────────────────────────────────────
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
  -- Try the views-based query first.
  BEGIN
    RETURN QUERY
    SELECT
      p.id AS product_id,
      COALESCE(
        NULLIF(to_jsonb(p)->>'name', ''),
        NULLIF(to_jsonb(p)->>'title', ''),
        'a product'
      ) AS product_name,
      COALESCE(
        NULLIF(to_jsonb(p)->>'image_url', ''),
        NULLIF(to_jsonb(p)->>'thumbnail_url', ''),
        NULLIF(to_jsonb(p)->>'photo_url', ''),
        NULLIF(to_jsonb(p)->'image_urls'->>0, ''),
        NULLIF(to_jsonb(p)->'images'->>0, '')
      ) AS image_url,
      COUNT(pv.id) AS view_count
    FROM public.products p
    LEFT JOIN public.product_views pv
      ON pv.product_id = p.id
     AND pv.viewed_at >= NOW() - INTERVAL '7 days'
    GROUP BY p.id
    HAVING COUNT(pv.id) > 0
    ORDER BY COUNT(pv.id) DESC
    LIMIT limit_count;
    RETURN;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      -- product_views table or some column doesn't exist; fall through to fallback.
      NULL;
  END;

  -- Fallback: most-recently-created products.
  RETURN QUERY
  SELECT
    p.id AS product_id,
    COALESCE(
      NULLIF(to_jsonb(p)->>'name', ''),
      NULLIF(to_jsonb(p)->>'title', ''),
      'a product'
    ) AS product_name,
    COALESCE(
      NULLIF(to_jsonb(p)->>'image_url', ''),
      NULLIF(to_jsonb(p)->>'thumbnail_url', ''),
      NULLIF(to_jsonb(p)->>'photo_url', ''),
      NULLIF(to_jsonb(p)->'image_urls'->>0, ''),
      NULLIF(to_jsonb(p)->'images'->>0, '')
    ) AS image_url,
    0::BIGINT AS view_count
  FROM public.products p
  ORDER BY COALESCE((to_jsonb(p)->>'created_at')::timestamptz, NOW()) DESC
  LIMIT limit_count;
END;
$$;
