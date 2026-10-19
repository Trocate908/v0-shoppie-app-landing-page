-- ============================================================================
-- In-app presence heartbeat (voice-call push notifications)
-- ============================================================================
-- Apply this file once in the Supabase SQL editor (or with `supabase db push`).
-- It is additive and idempotent, like add_voice_calls.sql.
--
-- Why
--   When a call starts, the callee must be told — but only if they are NOT
--   already looking at ShoppieApp (their in-app ring overlay handles that
--   case). The server cannot see Supabase Realtime presence state, so every
--   signed-in client writes a heartbeat here every 30 seconds while the app
--   is visible (see the presence effect in components/call-provider.tsx).
--   POST /api/calls/notify reads the callee's row and skips the push when the
--   heartbeat is fresh (under 45s old).
--
-- Until this migration is applied the client heartbeat fails silently and the
-- notify route fails open (it always pushes), so no call is ever silently
-- dropped — but in-app users may see a duplicate OS notification.
-- ============================================================================

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

-- Users may read and stamp only their own row; the server uses the service
-- role to read anyone's heartbeat.
drop policy if exists "Users manage their own presence" on public.user_presence;
create policy "Users manage their own presence"
  on public.user_presence
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_presence to authenticated;
