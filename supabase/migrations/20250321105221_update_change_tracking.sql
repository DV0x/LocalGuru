-- Migration: Add change tracking functionality
-- Description: Adds columns and functions for tracking content changes in Reddit data

-- Add change tracking columns to reddit_posts
ALTER TABLE reddit_posts 
ADD COLUMN IF NOT EXISTS content_checksum TEXT,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS update_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT FALSE;

-- Add change tracking columns to reddit_comments
ALTER TABLE reddit_comments 
ADD COLUMN IF NOT EXISTS content_checksum TEXT,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS update_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT FALSE;

-- Add columns to embedding_queue
ALTER TABLE util.embedding_queue
ADD COLUMN IF NOT EXISTS is_update BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_posts_checksum ON reddit_posts(content_checksum);
CREATE INDEX IF NOT EXISTS idx_comments_checksum ON reddit_comments(content_checksum);
CREATE INDEX IF NOT EXISTS idx_posts_last_checked ON reddit_posts(last_checked);
CREATE INDEX IF NOT EXISTS idx_comments_last_checked ON reddit_comments(last_checked);
CREATE INDEX IF NOT EXISTS idx_queue_cooldown ON util.embedding_queue(cooldown_until);

-- Create function to calculate content checksum
CREATE OR REPLACE FUNCTION calculate_content_checksum(
  p_content JSONB,
  p_fields TEXT[] DEFAULT ARRAY['title', 'content', 'score']
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_checksum_input TEXT := '';
  v_field TEXT;
BEGIN
  -- Build a string of the fields to hash
  FOREACH v_field IN ARRAY p_fields
  LOOP
    IF p_content ? v_field THEN
      v_checksum_input := v_checksum_input || COALESCE(p_content->>v_field, '');
    END IF;
  END LOOP;

  -- Return MD5 hash
  RETURN MD5(v_checksum_input);
END;
$$;

-- Create queue management functions
CREATE OR REPLACE FUNCTION reset_stuck_processing_jobs(max_processing_time_minutes integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE util.embedding_queue
  SET 
    status = 'pending',
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE
    status = 'processing'
    AND updated_at < NOW() - (max_processing_time_minutes || ' minutes')::interval;
    
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;

CREATE OR REPLACE FUNCTION prune_completed_jobs(keep_count integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
  completed_count integer;
BEGIN
  -- Count total completed jobs
  SELECT COUNT(*) INTO completed_count
  FROM util.embedding_queue
  WHERE status = 'completed';
  
  -- If we're under the keep count, do nothing
  IF completed_count <= keep_count THEN
    RETURN 0;
  END IF;
  
  -- Delete excess completed jobs
  DELETE FROM util.embedding_queue
  WHERE id IN (
    SELECT id
    FROM util.embedding_queue
    WHERE status = 'completed'
    ORDER BY updated_at ASC
    LIMIT (completed_count - keep_count)
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION trim_queue_to_size(max_size integer DEFAULT 10000)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
  queue_size integer;
BEGIN
  -- Count pending queue items
  SELECT COUNT(*) INTO queue_size
  FROM util.embedding_queue
  WHERE status = 'pending';
  
  -- If we're under the max size, do nothing
  IF queue_size <= max_size THEN
    RETURN 0;
  END IF;
  
  -- Delete excess items (lowest priority first)
  DELETE FROM util.embedding_queue
  WHERE id IN (
    SELECT id
    FROM util.embedding_queue
    WHERE status = 'pending'
    ORDER BY priority ASC, created_at DESC
    LIMIT (queue_size - max_size)
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant permissions to the functions
GRANT EXECUTE ON FUNCTION calculate_content_checksum TO service_role;
GRANT EXECUTE ON FUNCTION reset_stuck_processing_jobs TO service_role;
GRANT EXECUTE ON FUNCTION prune_completed_jobs TO service_role;
GRANT EXECUTE ON FUNCTION trim_queue_to_size TO service_role;

-- Add comments to functions
COMMENT ON FUNCTION calculate_content_checksum IS 'Calculates a checksum from a JSON object to detect content changes';
COMMENT ON FUNCTION reset_stuck_processing_jobs IS 'Resets jobs that have been stuck in processing state for too long';
COMMENT ON FUNCTION prune_completed_jobs IS 'Removes old completed jobs from the queue, keeping only the specified count';
COMMENT ON FUNCTION trim_queue_to_size IS 'Trims the pending queue to the specified maximum size'; 