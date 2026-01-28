-- Create a function to automatically clean up expired verification keys
CREATE OR REPLACE FUNCTION cleanup_expired_verification_keys()
RETURNS void AS $$
BEGIN
  -- Delete keys that have been used and expired
  DELETE FROM verification_keys
  WHERE 
    is_used = true 
    AND activated_at IS NOT NULL 
    AND activated_at + INTERVAL '30 days' < NOW();
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up expired verification keys at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Note: pg_cron must be enabled in Supabase project settings
-- If pg_cron is not available, you can manually run: SELECT cleanup_expired_verification_keys();

-- Alternatively, create a trigger-based approach
-- Create a function that runs cleanup on any verification_keys table access
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_keys()
RETURNS TRIGGER AS $$
BEGIN
  -- Run cleanup in background (don't block the operation)
  PERFORM cleanup_expired_verification_keys();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs cleanup periodically when vendors table is accessed
-- This ensures cleanup happens regularly without requiring pg_cron
CREATE OR REPLACE TRIGGER auto_cleanup_keys_trigger
AFTER INSERT OR UPDATE ON vendors
EXECUTE FUNCTION trigger_cleanup_expired_keys();

-- Add index for better cleanup performance
CREATE INDEX IF NOT EXISTS idx_verification_keys_expired 
ON verification_keys(is_used, activated_at) 
WHERE is_used = true AND activated_at IS NOT NULL;

-- Initial cleanup of any existing expired keys
SELECT cleanup_expired_verification_keys();
