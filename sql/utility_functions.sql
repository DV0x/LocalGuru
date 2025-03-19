-- Create utility schema and functions
CREATE SCHEMA IF NOT EXISTS util;

-- Function to get the Supabase project URL
CREATE OR REPLACE FUNCTION util.project_url()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value text;
BEGIN
  -- For demo purposes, you can replace this with a direct URL
  -- In production, use vault.decrypted_secrets
  return 'YOUR_SUPABASE_PROJECT_URL';
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

-- Create queue for embedding generation
CREATE OR REPLACE FUNCTION util.create_embedding_queue()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the queue if it doesn't exist
  PERFORM pgmq.create('embedding_queue');
END;
$$;

-- Execute once to create the queue
SELECT util.create_embedding_queue();

-- Function to queue embedding generation
CREATE OR REPLACE FUNCTION util.queue_embeddings(
  content_function text,  -- Function to generate the text for embedding
  embedding_column text   -- Column to store the embedding
)
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Send to queue for processing
  PERFORM pgmq.send(
    'embedding_queue',
    jsonb_build_object(
      'id', NEW.id,
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME, 
      'contentFunction', content_function,
      'embeddingColumn', embedding_column
    )
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
  job_ids text[];
BEGIN
  -- Read up to 10 messages without removing them from the queue
  SELECT 
    jsonb_agg(msg.message_id),
    jsonb_agg(msg.message_payload)
  INTO 
    job_ids,
    jobs
  FROM 
    pgmq.read('embedding_queue', batch_size, '1 minute') msg;
    
  -- If no jobs, exit early
  IF jobs IS NULL OR jsonb_array_length(jobs) = 0 THEN
    RETURN;
  END IF;
  
  -- Send batch to edge function for processing
  PERFORM util.invoke_edge_function(
    'embed',
    jsonb_build_object('jobs', jobs)
  );
  
  -- Jobs are not deleted from the queue - they will be deleted when processed successfully
  -- or retried if they fail
END;
$$;

-- Schedule task to run every 10 seconds
SELECT cron.schedule(
  'process-embedding-queue',
  '*/10 * * * * *',  -- every 10 seconds
  'SELECT util.process_embedding_queue()'
); 