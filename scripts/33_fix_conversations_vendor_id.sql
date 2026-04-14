-- Fix conversations table: vendor_id should be a plain UUID (auth user id),
-- NOT a FK into vendors(id), because buyers use Supabase auth directly
-- and the vendor_id stored is the vendor's auth user id (vendors.user_id).
-- Drop the existing FK constraint and re-create without it.

-- Step 1: Drop the existing table and recreate cleanly
-- (safe because conversations were just created and have no real data yet)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Step 2: Recreate conversations with vendor_id as plain UUID (no FK)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,   -- auth.uid() of the buyer (anonymous or registered)
  vendor_id UUID NOT NULL,  -- vendors.user_id (auth.uid() of the vendor)
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, buyer_id, vendor_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = vendor_id);

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vendor_id ON conversations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_product_id ON conversations(product_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Step 3: Recreate messages (no FK changes needed here)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  "read" BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT messages_check_content CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversation messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.buyer_id = auth.uid() OR conversations.vendor_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages into their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.buyer_id = auth.uid() OR conversations.vendor_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages("read");
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted);

-- Step 4: Enable Realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
