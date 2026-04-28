-- Add video_duration_seconds column to shop_statuses table
ALTER TABLE shop_statuses 
ADD COLUMN IF NOT EXISTS video_duration_seconds FLOAT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN shop_statuses.video_duration_seconds IS 'Duration of video in seconds (for video media_type only)';
