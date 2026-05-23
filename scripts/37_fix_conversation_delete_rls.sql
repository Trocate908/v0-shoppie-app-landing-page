-- Fix: the conversations table had no DELETE RLS policy, so deletes from the
-- server were silently blocked — the row stayed in the DB and the chat kept
-- reappearing for the user after they tapped "Delete".
--
-- Allow either participant (buyer or vendor) to delete their shared conversation.
-- The `ON DELETE CASCADE` on messages.conversation_id will remove all messages
-- automatically — no need to delete them separately in app code.

DROP POLICY IF EXISTS "Participants can delete conversations" ON conversations;

CREATE POLICY "Participants can delete conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = buyer_id OR auth.uid() = vendor_id);
