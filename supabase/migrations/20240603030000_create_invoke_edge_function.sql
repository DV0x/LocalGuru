-- Create the util schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS util;

-- Create a function to invoke edge functions
CREATE OR REPLACE FUNCTION util.invoke_edge_function(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb,
  timeout_ms int DEFAULT 5000
)
RETURNS TABLE (
  status int,
  content jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  project_ref text;
  anon_key text;
  edge_function_url text;
  response_status int;
  response_content jsonb;
  start_time timestamptz;
  elapsed_ms int;
BEGIN
  -- Get project ref from current database connection
  SELECT
    CASE 
      WHEN current_database() LIKE 'postgres%' AND current_database() NOT LIKE '%local' 
      THEN (regexp_match(current_database(), 'postgres\.([a-z0-9]+)'))[1] 
      ELSE 'local' 
    END INTO project_ref;

  -- Get anon key from supabase_functions.hooks table, or use a default for local dev
  BEGIN
    SELECT secret FROM supabase_functions.hooks WHERE hook_table_id = 1 INTO anon_key;
    IF anon_key IS NULL THEN
      anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Default anon key for local development
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  END;
  
  -- Construct the URL for the edge function
  IF project_ref = 'local' THEN
    edge_function_url := 'http://localhost:54321/functions/v1/' || function_name;
  ELSE
    edge_function_url := 'https://' || project_ref || '.supabase.co/functions/v1/' || function_name;
  END IF;

  -- Call the edge function using CURL
  start_time := clock_timestamp();
  
  SELECT 
    status, content::jsonb
  INTO
    response_status, response_content
  FROM 
    extensions.http(
      'POST',
      edge_function_url,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      payload::text,
      timeout_ms
    );

  elapsed_ms := extract(epoch from (clock_timestamp() - start_time)) * 1000;
  
  IF elapsed_ms >= timeout_ms THEN
    RAISE EXCEPTION 'Edge function timeout after % ms', elapsed_ms;
  END IF;
  
  RETURN QUERY SELECT response_status, response_content;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION util.invoke_edge_function(text, jsonb, int) TO service_role;
GRANT EXECUTE ON FUNCTION util.invoke_edge_function(text, jsonb, int) TO anon;
GRANT EXECUTE ON FUNCTION util.invoke_edge_function(text, jsonb, int) TO authenticated; 