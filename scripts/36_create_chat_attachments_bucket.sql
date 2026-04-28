-- Create storage bucket for chat message attachments (images, etc.)
-- Files are organized by conversation_id so RLS can scope access per participant.

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- Public read is fine: attachment URLs are unguessable UUIDs and messages themselves
-- are RLS-protected. This keeps the client simple (no signed-url dance).
drop policy if exists "Public can view chat attachments" on storage.objects;
create policy "Public can view chat attachments"
on storage.objects for select
using (bucket_id = 'chat-attachments');

-- Any authenticated user can upload to the bucket — we verify they belong to the
-- conversation at message-send time via the messages API / RLS on messages table.
drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
);

-- Users can delete only the objects they uploaded (owner column set by Supabase).
drop policy if exists "Users can delete own chat attachments" on storage.objects;
create policy "Users can delete own chat attachments"
on storage.objects for delete
using (
  bucket_id = 'chat-attachments'
  and auth.uid() = owner
);
