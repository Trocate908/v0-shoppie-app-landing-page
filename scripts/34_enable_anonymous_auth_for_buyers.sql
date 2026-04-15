-- Enable anonymous sign-ins for buyers so they can message vendors
-- without needing to create a full account.
-- Anonymous users get a real auth.uid() so RLS policies work normally.

-- The conversations INSERT policy already allows any auth.uid() as buyer_id.
-- The messages INSERT policy checks auth.uid() = sender_id and participation.
-- Both work seamlessly with anonymous users.

-- No schema changes needed — anonymous auth is enabled in the Supabase dashboard
-- under Authentication > Providers > Anonymous.
-- This script documents the requirement and adds a helpful comment to conversations.

COMMENT ON COLUMN conversations.buyer_id IS
  'auth.uid() of the buyer — may be an anonymous Supabase user or a registered vendor user';

COMMENT ON COLUMN conversations.vendor_id IS
  'vendors.user_id (auth.uid()) of the vendor — always a registered Supabase auth user';
