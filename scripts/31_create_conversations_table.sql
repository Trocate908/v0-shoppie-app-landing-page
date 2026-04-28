-- Create conversations table for product-based messaging
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, buyer_id, vendor_id)
);

-- Enable RLS on conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Participants can view their conversations
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = vendor_id);

-- RLS Policy: Anyone authenticated can insert conversations
CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- RLS Policy: Participants can update their conversations
CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = vendor_id);

-- Create index for faster lookups
CREATE INDEX idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX idx_conversations_vendor_id ON conversations(vendor_id);
CREATE INDEX idx_conversations_product_id ON conversations(product_id);
