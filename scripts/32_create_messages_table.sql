-- Create messages table for conversations
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

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Conversation participants can view messages in their conversations
CREATE POLICY "Participants can view conversation messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.buyer_id = auth.uid() OR conversations.vendor_id = auth.uid())
    )
  );

-- RLS Policy: Authenticated users can insert messages into their conversations
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

-- RLS Policy: Only sender can update their own messages
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- RLS Policy: Only sender can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Create indexes for faster lookups
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_read ON messages("read");
CREATE INDEX idx_messages_deleted ON messages(deleted);
