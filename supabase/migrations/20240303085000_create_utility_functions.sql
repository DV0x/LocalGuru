-- Migration: Create utility functions
-- Description: Sets up utility schema and functions for embeddings and other operations

-- Create utility schema
CREATE SCHEMA IF NOT EXISTS util;

-- Create embedding job queue table
CREATE TABLE IF NOT EXISTS util.embedding_queue (
  id SERIAL PRIMARY KEY,
  record_id TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  content_function TEXT NOT NULL,
  embedding_column TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ
);

-- Create index on status for quick lookups
CREATE INDEX IF NOT EXISTS embedding_queue_status_idx ON util.embedding_queue(status);

-- Function to get the Supabase project URL
CREATE OR REPLACE FUNCTION util.project_url()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value text;
BEGIN
  -- Try to get from vault first
  BEGIN
    SELECT value INTO secret_value FROM vault.decrypted_secrets WHERE name = 'project_url';
    RETURN secret_value;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to project URL
    RETURN current_setting('request.url_scheme') || '://' || 
           regexp_replace(current_setting('request.headers')::json->>'host', ':[0-9]+$', '');
  END;
END;
$$;

-- Generic function to invoke Edge Functions
CREATE OR REPLACE FUNCTION util.invoke_edge_function(
  name text,
  body jsonb,
  timeout_milliseconds int = 5 * 60 * 1000 -- default 5 minute timeout
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  headers_raw text;
  auth_header text;
BEGIN
  -- If we're in a PostgREST session, reuse the request headers for authorization
  headers_raw := current_setting('request.headers', true);

  -- Only try to parse if headers are present
  auth_header := case
    when headers_raw is not null then
      (headers_raw::json->>'authorization')
    else
      null
    end;

  -- Perform async HTTP request to the edge function
  PERFORM net.http_post(
    url => util.project_url() || '/functions/v1/' || name,
    headers => jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', auth_header
    ),
    body => body,
    timeout_milliseconds => timeout_milliseconds
  );
END;
$$;

-- Generic trigger function to clear a column on update
CREATE OR REPLACE FUNCTION util.clear_column()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  clear_column text := TG_ARGV[0];
BEGIN
  NEW := NEW #= hstore(clear_column, NULL);
  RETURN NEW;
END;
$$;

-- Function to queue embedding generation
CREATE OR REPLACE FUNCTION util.queue_embeddings()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  content_function text := TG_ARGV[0];
  embedding_column text := TG_ARGV[1];
BEGIN
  -- Get the schema name and table name from trigger context
  INSERT INTO util.embedding_queue (
    record_id,
    schema_name,
    table_name,
    content_function,
    embedding_column
  ) VALUES (
    NEW.id,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    content_function,
    embedding_column
  );
  
  RETURN NEW;
END;
$$;

-- Scheduled task to process embedding queue
CREATE OR REPLACE FUNCTION util.process_embedding_queue()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  batch_size int := 10;
  jobs jsonb;
BEGIN
  -- Mark batch as processing
  WITH batch AS (
    SELECT id, record_id, schema_name, table_name, content_function, embedding_column
    FROM util.embedding_queue
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE util.embedding_queue q
  SET 
    status = 'processing',
    attempts = attempts + 1
  FROM batch
  WHERE q.id = batch.id
  RETURNING jsonb_agg(
    jsonb_build_object(
      'jobId', q.id,
      'id', q.record_id,
      'schema', q.schema_name,
      'table', q.table_name,
      'contentFunction', q.content_function,
      'embeddingColumn', q.embedding_column
    )
  ) INTO jobs;
    
  -- If no jobs, exit early
  IF jobs IS NULL OR jsonb_array_length(jobs) = 0 THEN
    RETURN;
  END IF;
  
  -- Send batch to edge function for processing
  PERFORM util.invoke_edge_function(
    'embed',
    jsonb_build_object('jobs', jobs)
  );
  
  -- Jobs will be marked as completed by the edge function
END;
$$;

-- Schedule task to run every 10 seconds
SELECT cron.schedule(
  'process-embedding-queue',
  '*/10 * * * * *',  -- every 10 seconds
  'SELECT util.process_embedding_queue()'
); 