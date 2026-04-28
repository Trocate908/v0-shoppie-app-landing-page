-- Add delivered column to messages table
-- delivered = false → single grey tick (receiver has not received the message yet)
-- delivered = true, read = false → double grey ticks (delivered but not read)
-- delivered = true, read = true → double blue ticks (read)

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE;

-- Messages already marked as "read" are also considered delivered
UPDATE messages SET delivered = TRUE WHERE "read" = TRUE;

-- Add an index for efficient lookups on delivered status
CREATE INDEX IF NOT EXISTS idx_messages_delivered ON messages(delivered);

-- Update the RLS policy to allow receivers to mark messages as delivered/read
-- Drop the existing update policy (only sender could update)
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- New policy: senders can edit content; receivers can mark delivered/read
CREATE POLICY "Users can update messages they are party to"
  ON messages FOR UPDATE
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.buyer_id = auth.uid() OR conversations.vendor_id = auth.uid())
        AND auth.uid() != messages.sender_id
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.buyer_id = auth.uid() OR conversations.vendor_id = auth.uid())
        AND auth.uid() != messages.sender_id
    )
  );
