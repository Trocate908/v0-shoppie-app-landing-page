-- Add indexes to optimize conversations and messages queries

-- Index for fast conversation lookup by user
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_vendor_id ON conversations(vendor_id) WHERE deleted_at IS NULL;

-- Index for fast sorting by last_message_at
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST) WHERE deleted_at IS NULL;

-- Compound index for conversation product lookup (speeds up race condition handling)
CREATE INDEX IF NOT EXISTS idx_conversations_product_buyer_vendor ON conversations(product_id, buyer_id, vendor_id) WHERE deleted_at IS NULL;

-- Indexes for messages table to speed up unread/delivered queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_messages_read_status ON messages(conversation_id, read) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_messages_delivered_status ON messages(conversation_id, delivered, sender_id) WHERE deleted = false;

-- Index for fast last message retrieval per conversation
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(conversation_id, created_at DESC) WHERE deleted = false;

-- Index for sender_id queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id) WHERE deleted = false;
