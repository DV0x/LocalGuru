-- Enhance embedding queue with prioritization and advanced filtering

-- Update embedding_queue table to add priority and subreddit fields
ALTER TABLE util.embedding_queue
ADD COLUMN IF NOT EXISTS priority SMALLINT DEFAULT 5,
ADD COLUMN IF NOT EXISTS subreddit TEXT,
ADD COLUMN IF NOT EXISTS estimated_tokens INTEGER;

-- Create index on priority and status for efficient job selection
CREATE INDEX IF NOT EXISTS embedding_queue_priority_status_idx 
ON util.embedding_queue(priority DESC, status, created_at)
WHERE status = 'pending';

-- Create index on subreddit for filtering
CREATE INDEX IF NOT EXISTS embedding_queue_subreddit_idx 
ON util.embedding_queue(subreddit)
WHERE subreddit IS NOT NULL;

-- Helper function to create prioritized embedding jobs
CREATE OR REPLACE FUNCTION util.add_to_embedding_queue(
  record_id TEXT,
  schema_name TEXT,
  table_name TEXT,
  content_function TEXT,
  embedding_column TEXT,
  priority SMALLINT DEFAULT 5,
  estimated_tokens INTEGER DEFAULT NULL,
  subreddit TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Send to queue for processing
  INSERT INTO util.embedding_queue
  (record_id, schema_name, table_name, content_function, embedding_column, status, priority, subreddit, estimated_tokens)
  VALUES 
  (record_id, schema_name, table_name, content_function, embedding_column, 'pending', priority, subreddit, estimated_tokens)
  ON CONFLICT (record_id, schema_name, table_name) 
  DO UPDATE SET 
    status = 'pending',
    attempts = 0,
    last_error = NULL,
    priority = EXCLUDED.priority,
    subreddit = EXCLUDED.subreddit,
    estimated_tokens = EXCLUDED.estimated_tokens;
END;
$$;

-- Function to create a trigger for high priority content
CREATE OR REPLACE FUNCTION util.queue_embeddings_high_priority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  record_subreddit TEXT := NULL;
  content_function TEXT := TG_ARGV[0];
  embedding_column TEXT := TG_ARGV[1];
BEGIN
  -- Extract subreddit if this is a reddit post
  IF TG_TABLE_NAME = 'reddit_posts' THEN
    record_subreddit := NEW.subreddit;
  END IF;

  -- Add to queue with high priority (10)
  PERFORM util.add_to_embedding_queue(
    NEW.id, 
    TG_TABLE_SCHEMA, 
    TG_TABLE_NAME, 
    content_function, 
    embedding_column, 
    10, -- High priority
    NULL, -- Estimated tokens (calculated later)
    record_subreddit
  );
  
  RETURN NEW;
END;
$$;

-- Function to create a trigger for normal priority content
CREATE OR REPLACE FUNCTION util.queue_embeddings_normal_priority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  record_subreddit TEXT := NULL;
  content_function TEXT := TG_ARGV[0];
  embedding_column TEXT := TG_ARGV[1];
BEGIN
  -- Extract subreddit if this is a reddit post
  IF TG_TABLE_NAME = 'reddit_posts' THEN
    record_subreddit := NEW.subreddit;
  END IF;

  -- Add to queue with normal priority (5)
  PERFORM util.add_to_embedding_queue(
    NEW.id, 
    TG_TABLE_SCHEMA, 
    TG_TABLE_NAME, 
    content_function, 
    embedding_column, 
    5, -- Normal priority
    NULL, -- Estimated tokens (calculated later)
    record_subreddit
  );
  
  RETURN NEW;
END;
$$;

-- Function to create a trigger for low priority content
CREATE OR REPLACE FUNCTION util.queue_embeddings_low_priority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  record_subreddit TEXT := NULL;
  content_function TEXT := TG_ARGV[0];
  embedding_column TEXT := TG_ARGV[1];
BEGIN
  -- Extract subreddit if this is a reddit post
  IF TG_TABLE_NAME = 'reddit_posts' THEN
    record_subreddit := NEW.subreddit;
  END IF;

  -- Add to queue with low priority (1)
  PERFORM util.add_to_embedding_queue(
    NEW.id, 
    TG_TABLE_SCHEMA, 
    TG_TABLE_NAME, 
    content_function, 
    embedding_column, 
    1, -- Low priority
    NULL, -- Estimated tokens (calculated later)
    record_subreddit
  );
  
  RETURN NEW;
END;
$$;

-- Function to get pending jobs with priority and filtering options
CREATE OR REPLACE FUNCTION public.get_pending_embedding_jobs_with_priority(
  limit_count integer DEFAULT 10,
  min_priority smallint DEFAULT 1,
  filter_subreddit text DEFAULT NULL
)
RETURNS SETOF util.embedding_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF filter_subreddit IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM util.embedding_queue
    WHERE 
      status = 'pending' AND
      attempts < 3 AND
      priority >= min_priority AND
      subreddit = filter_subreddit
    ORDER BY priority DESC, created_at ASC
    LIMIT limit_count;
  ELSE
    RETURN QUERY
    SELECT *
    FROM util.embedding_queue
    WHERE 
      status = 'pending' AND
      attempts < 3 AND
      priority >= min_priority
    ORDER BY priority DESC, created_at ASC
    LIMIT limit_count;
  END IF;
END;
$$;

-- Function to reset a job's status (for token budget management)
CREATE OR REPLACE FUNCTION public.reset_job_status(job_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE util.embedding_queue
  SET status = 'pending'
  WHERE id = job_id;
  
  RETURN FOUND;
END;
$$;

-- Optimized job retention policy for completed jobs
CREATE OR REPLACE FUNCTION util.cleanup_embedding_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete old completed jobs (keep for 7 days)
  DELETE FROM util.embedding_queue
  WHERE 
    status = 'completed' AND
    processed_at < (now() - interval '7 days');
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Keep only 100 most recent failed jobs per error type
  WITH ranked_failed_jobs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY last_error ORDER BY processed_at DESC) as rn
    FROM util.embedding_queue
    WHERE status = 'failed'
  )
  DELETE FROM util.embedding_queue
  WHERE id IN (
    SELECT id FROM ranked_failed_jobs
    WHERE rn > 100
  );
  
  RETURN deleted_count;
END;
$$;

-- Schedule cleanup to run daily (if cron is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-embedding-queue',
      '0 3 * * *',  -- Run at 3 AM daily
      'SELECT util.cleanup_embedding_queue()'
    );
  END IF;
END $$; 