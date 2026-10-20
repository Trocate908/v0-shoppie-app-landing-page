-- Messaging performance indexes
-- ============================================================================
-- Apply once in the Supabase SQL editor (or `supabase db push`). Additive and
-- idempotent.
--
-- Why: the inbox and thread endpoints both read messages by conversation and
-- ordered by recency, and both filter on `read`/`delivered`. The existing
-- indexes cover `conversation_id` alone, which still forces Postgres to fetch
-- and sort every message in a conversation before returning the newest page.
--
-- Note on names: scripts/32 already created `idx_messages_created_at` on
-- (created_at DESC), so a composite index cannot reuse that name — `CREATE
-- INDEX IF NOT EXISTS` would silently skip it. The names below are new so the
-- indexes are actually built.
-- ============================================================================

-- Newest page of a thread in one index scan (list preview + thread open).
create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc);

-- Unread badge / per-conversation unread counts only ever look at unread rows.
create index if not exists idx_messages_conversation_unread
  on public.messages (conversation_id)
  where "read" = false;

-- Delivered receipts are the same shape.
create index if not exists idx_messages_conversation_undelivered
  on public.messages (conversation_id)
  where delivered = false;

-- Inbox ordering for each side of a conversation.
create index if not exists idx_conversations_buyer_recent
  on public.conversations (buyer_id, last_message_at desc);

create index if not exists idx_conversations_vendor_recent
  on public.conversations (vendor_id, last_message_at desc);

-- Refresh planner statistics so the new indexes are used immediately.
analyze public.messages;
analyze public.conversations;
