-- =====================================================================
-- ShoppieApp — Notification System
-- Run this on your Supabase project (oimotawwhhppuggbkzeh)
-- =====================================================================

-- ───────────────────────────────────────────────────────────────────────
-- 1) FCM device tokens
--    Stores Firebase Cloud Messaging tokens per device.
--    A user (or anonymous shopper) may have multiple devices.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id       TEXT,                      -- random uuid stored in localStorage for anonymous shoppers
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
-- 2) Notifications (in-app inbox)
--    Mirrors what's pushed via FCM so users can see history when they
--    return to the app even if they missed the push.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     TEXT,                            -- for anonymous shoppers
  type          TEXT NOT NULL,                   -- 'message' | 'trending' | 'product_loved' | 'start_posting' | 'new_product' | 'custom'
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  link          TEXT,                            -- e.g. /product/abc, /vendor/dashboard
  image_url     TEXT,
  metadata      JSONB,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_device_id   ON public.notifications(device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read        ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type        ON public.notifications(type);

-- ───────────────────────────────────────────────────────────────────────
-- 3) Engagement send log
--    Prevents the cron job from spamming the same user with the same
--    message type twice in a short window.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_sends (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,
  device_id    TEXT,
  type         TEXT NOT NULL,
  ref_id       TEXT,                             -- e.g. product id for product_loved, to avoid duplicate per product
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

-- push_tokens: a user manages their own; anonymous tokens may be inserted by anyone but only read/edited by no one (only service role)
DROP POLICY IF EXISTS "push_tokens_select_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_update_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own"  ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_anon" ON public.push_tokens;

CREATE POLICY "push_tokens_select_own"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "push_tokens_update_own"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_own"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- notifications: a user reads/updates their own; anonymous device notifications are read via the API route only (service role)
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_sends is internal — no policies = no public access (service role only).

-- ───────────────────────────────────────────────────────────────────────
-- 5) Helper: trending products (last 7 days by view count)
--    See scripts/002_notifications_fix_trending.sql for the canonical
--    schema-agnostic version. The version below is kept only as a stub
--    so re-running this file is safe; it is overwritten by 002.
-- ───────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_trending_products(INT);
CREATE OR REPLACE FUNCTION public.get_trending_products(limit_count INT DEFAULT 5)
RETURNS TABLE (
  product_id   UUID,
  product_name TEXT,
  image_url    TEXT,
  view_count   BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::BIGINT WHERE FALSE;
$$;
