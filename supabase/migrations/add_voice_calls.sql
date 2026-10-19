-- ============================================================================
-- Phase 1: one-to-one in-app voice calling
-- ============================================================================
-- Apply this file once in the Supabase SQL editor (or with `supabase db push`)
-- before the in-app call UI can work. It is additive and idempotent.
--
-- Model
--   public.calls         one row per call attempt (state + history)
--   public.call_signals  private WebRTC offer / answer / ICE rows, readable and
--                        writable only by the two participants of that call
--
-- Identity
--   caller_id / callee_id are auth.users ids. They are derived server-side from
--   public.conversations, never taken from the browser, so a caller cannot ring
--   someone else on behalf of another account.
--
-- Writes to public.calls go through SECURITY DEFINER functions only. Clients can
-- read their own calls (for realtime), but cannot insert, update or delete them
-- directly, which keeps status transitions and participants trustworthy.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null,
  callee_id uuid not null,
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'ended', 'declined', 'missed', 'cancelled', 'failed')),
  end_reason text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  constraint calls_distinct_participants check (caller_id <> callee_id)
);

create index if not exists idx_calls_conversation on public.calls(conversation_id);
create index if not exists idx_calls_caller on public.calls(caller_id, created_at desc);
create index if not exists idx_calls_callee on public.calls(callee_id, created_at desc);
create index if not exists idx_calls_live on public.calls(status) where status in ('ringing', 'active');

create table if not exists public.call_signals (
  id bigserial primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  sender_id uuid not null,
  kind text not null check (kind in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_call_signals_call on public.call_signals(call_id, created_at);

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.calls enable row level security;
alter table public.call_signals enable row level security;

drop policy if exists "Participants can view their calls" on public.calls;
create policy "Participants can view their calls"
  on public.calls for select to authenticated
  using (auth.uid() = caller_id or auth.uid() = callee_id);

-- No direct INSERT/UPDATE/DELETE policies on purpose: only the RPCs below may
-- change call state. Privileges are revoked further down as well.

drop policy if exists "Participants can view call signals" on public.call_signals;
create policy "Participants can view call signals"
  on public.call_signals for select to authenticated
  using (
    exists (
      select 1 from public.calls c
      where c.id = call_signals.call_id
        and (c.caller_id = auth.uid() or c.callee_id = auth.uid())
    )
  );

drop policy if exists "Participants can send call signals" on public.call_signals;
create policy "Participants can send call signals"
  on public.call_signals for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.calls c
      where c.id = call_signals.call_id
        and (c.caller_id = auth.uid() or c.callee_id = auth.uid())
        and c.status in ('ringing', 'active')
    )
  );

-- Table privileges: read-only calls, read/append signals.
revoke all on public.calls from anon, authenticated;
grant select on public.calls to authenticated;

revoke all on public.call_signals from anon, authenticated;
grant select, insert on public.call_signals to authenticated;
-- The identity column needs its sequence to be usable by signed-in clients.
do $$
begin
  grant usage, select on sequence public.call_signals_id_seq to authenticated;
exception
  when undefined_table then null;
end;
$$;

-- ── start_call ──────────────────────────────────────────────────────────────
-- Validates the caller, derives the callee from the conversation, expires stale
-- ringing rows and rejects busy participants. Returns the created call.

create or replace function public.start_call(p_conversation_id uuid)
returns public.calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations%rowtype;
  v_callee uuid;
  v_call public.calls%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'conversation_not_found';
  end if;

  if v_uid <> v_conv.buyer_id and v_uid <> v_conv.vendor_id then
    raise exception 'not_a_participant';
  end if;

  -- The recipient is always the other side of the conversation, never a value
  -- supplied by the browser.
  if v_uid = v_conv.buyer_id then
    v_callee := v_conv.vendor_id;
  else
    v_callee := v_conv.buyer_id;
  end if;

  -- Serialise crossing call attempts between the same pair.
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(v_uid, v_callee)::text || ':' || greatest(v_uid, v_callee)::text,
      0
    )
  );

  -- Expire ringing calls that never got answered so they cannot block new ones.
  update public.calls
     set status = 'missed', ended_at = now(), end_reason = 'timeout'
   where status = 'ringing'
     and created_at < now() - interval '60 seconds'
     and (caller_id = v_uid or callee_id = v_uid or caller_id = v_callee or callee_id = v_callee);

  -- Abandoned rings must not leave SDP/ICE payloads behind.
  delete from public.call_signals s
   using public.calls c
   where s.call_id = c.id
     and c.status = 'missed'
     and c.created_at < now() - interval '60 seconds'
     and (c.caller_id = v_uid or c.callee_id = v_uid or c.caller_id = v_callee or c.callee_id = v_callee);

  if exists (
    select 1 from public.calls
     where status in ('ringing', 'active')
       and (caller_id = v_uid or callee_id = v_uid)
  ) then
    raise exception 'already_in_call';
  end if;

  if exists (
    select 1 from public.calls
     where status in ('ringing', 'active')
       and (caller_id = v_callee or callee_id = v_callee)
  ) then
    raise exception 'callee_busy';
  end if;

  insert into public.calls (conversation_id, caller_id, callee_id)
  values (p_conversation_id, v_uid, v_callee)
  returning * into v_call;

  return v_call;
end;
$$;

revoke all on function public.start_call(uuid) from public, anon;
grant execute on function public.start_call(uuid) to authenticated;

-- ── respond_call ────────────────────────────────────────────────────────────
-- Every transition is validated against the caller's identity and the current
-- status, so one participant cannot accept on the other's behalf or resurrect a
-- finished call.

create or replace function public.respond_call(
  p_call_id uuid,
  p_action text,
  p_reason text default null
)
returns public.calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := lower(coalesce(p_action, ''));
  v_call public.calls%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_call from public.calls where id = p_call_id for update;
  if not found then
    raise exception 'call_not_found';
  end if;

  if v_uid <> v_call.caller_id and v_uid <> v_call.callee_id then
    raise exception 'not_a_participant';
  end if;

  if v_action = 'accept' then
    if v_uid <> v_call.callee_id then
      raise exception 'only_callee_can_accept';
    end if;
    if v_call.status <> 'ringing' then
      raise exception 'call_not_ringing';
    end if;
    if v_call.created_at < now() - interval '60 seconds' then
      -- Persist the missed state instead of raising: an exception would roll
      -- the UPDATE back and leave the ring stuck.
      update public.calls
         set status = 'missed', ended_at = now(), end_reason = 'timeout'
       where id = v_call.id
      returning * into v_call;
      delete from public.call_signals where call_id = v_call.id;
      return v_call;
    end if;
    update public.calls
       set status = 'active', answered_at = now(), end_reason = null
     where id = v_call.id
    returning * into v_call;

  elsif v_action = 'decline' then
    if v_uid <> v_call.callee_id then
      raise exception 'only_callee_can_decline';
    end if;
    if v_call.status = 'ringing' then
      update public.calls
         set status = 'declined',
             ended_at = now(),
             end_reason = coalesce(p_reason, 'declined')
       where id = v_call.id
      returning * into v_call;
    else
      return v_call;
    end if;

  elsif v_action = 'cancel' then
    if v_uid <> v_call.caller_id then
      raise exception 'only_caller_can_cancel';
    end if;
    if v_call.status = 'ringing' then
      update public.calls
         set status = 'cancelled',
             ended_at = now(),
             end_reason = coalesce(p_reason, 'cancelled')
       where id = v_call.id
      returning * into v_call;
    else
      return v_call;
    end if;

  elsif v_action = 'end' then
    if v_call.status = 'active' then
      update public.calls
         set status = 'ended',
             ended_at = now(),
             end_reason = coalesce(p_reason, 'hangup')
       where id = v_call.id
      returning * into v_call;
    elsif v_call.status = 'ringing' then
      -- Ringing + "end" is a plain cancellation; keep history accurate.
      update public.calls
         set status = case when v_uid = v_call.caller_id then 'cancelled' else 'declined' end,
             ended_at = now(),
             end_reason = coalesce(p_reason, 'hangup')
       where id = v_call.id
      returning * into v_call;
    else
      return v_call;
    end if;

  elsif v_action = 'missed' then
    if v_call.status <> 'ringing' then
      return v_call;
    end if;
    update public.calls
       set status = 'missed',
           ended_at = now(),
           end_reason = coalesce(p_reason, 'timeout')
     where id = v_call.id
    returning * into v_call;

  elsif v_action = 'fail' then
    if v_call.status in ('ringing', 'active') then
      update public.calls
         set status = 'failed',
             ended_at = now(),
             end_reason = coalesce(p_reason, 'connection_lost')
       where id = v_call.id
      returning * into v_call;
    else
      return v_call;
    end if;

  else
    raise exception 'invalid_action';
  end if;

  -- SDP and ICE payloads include network details; once a call is over they are
  -- no longer needed, so drop the private signaling rows.
  if v_call.status in ('ended', 'declined', 'missed', 'cancelled', 'failed') then
    delete from public.call_signals where call_id = v_call.id;
  end if;

  return v_call;
end;
$$;

revoke all on function public.respond_call(uuid, text, text) from public, anon;
grant execute on function public.respond_call(uuid, text, text) to authenticated;

-- ── expire_stale_calls ──────────────────────────────────────────────────────
-- Called by the client on mount / resume. Ringing rows older than a minute and
-- active rows abandoned for hours are closed, and their signal payloads removed.

create or replace function public.expire_stale_calls()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  update public.calls
     set status = 'missed', ended_at = now(), end_reason = 'timeout'
   where status = 'ringing'
     and created_at < now() - interval '60 seconds'
     and (caller_id = v_uid or callee_id = v_uid);

  update public.calls
     set status = 'ended', ended_at = now(), end_reason = 'stale'
   where status = 'active'
     and created_at < now() - interval '2 hours'
     and (caller_id = v_uid or callee_id = v_uid);

  delete from public.call_signals s
   using public.calls c
   where s.call_id = c.id
     and (c.caller_id = v_uid or c.callee_id = v_uid)
     and c.status in ('ended', 'declined', 'missed', 'cancelled', 'failed');
end;
$$;

revoke all on function public.expire_stale_calls() from public, anon;
grant execute on function public.expire_stale_calls() to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Ringing, acceptance and hang-ups arrive as postgres_changes on public.calls;
-- SDP/ICE arrive on public.call_signals. Both are filtered by RLS above.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  begin
    execute 'alter publication supabase_realtime add table public.calls';
  exception
    when duplicate_object then null;
  end;

  begin
    execute 'alter publication supabase_realtime add table public.call_signals';
  exception
    when duplicate_object then null;
  end;
end;
$$;
