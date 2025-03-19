-- Create vector type for search_content_multi_strategy function

-- First ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Comment to confirm the vector extension is installed
COMMENT ON EXTENSION vector IS 'vector data type and related functions';

-- Check if generate_embeddings function exists, we'll need to recreate it with the correct type
DROP FUNCTION IF EXISTS public.generate_embeddings(text);

-- Create generate_embeddings function with explicit vector type
CREATE OR REPLACE FUNCTION public.generate_embeddings(input TEXT)
RETURNS vector(1536)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  embedding_vector vector(1536);
  cached_embedding vector(1536);
  cache_key text;
  edge_function_result jsonb;
  edge_function_embedding jsonb;
BEGIN
  -- Return early if input is null or empty
  IF input IS NULL OR length(trim(input)) = 0 THEN
    RAISE WARNING 'Empty or NULL input provided to generate_embeddings';
    RETURN array_fill(0.0, ARRAY[1536])::vector(1536);
  END IF;

  -- Check embedding cache first (if the table exists)
  cache_key := md5(input);
  BEGIN
    SELECT embedding INTO cached_embedding
    FROM public.embedding_cache
    WHERE query_hash = cache_key
      AND created_at > now() - interval '7 days'
    LIMIT 1;
    
    IF FOUND THEN
      -- Cache hit!
      RETURN cached_embedding;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If embedding_cache table doesn't exist, just continue
    NULL;
  END;

  -- Call the query-embeddings edge function using invoke_edge_function
  BEGIN
    SELECT content INTO edge_function_result
    FROM util.invoke_edge_function(
      'query-embeddings',  -- Name of the edge function
      jsonb_build_object(  -- Payload for the edge function
        'query', input,
        'storeInCache', true
      )
    );

    -- Extract embedding from the edge function response
    edge_function_embedding := edge_function_result->'embedding';
    
    -- Convert JSON array to a Postgres vector
    embedding_vector := edge_function_embedding::text::float[]::vector(1536);
    
    RETURN embedding_vector;
  EXCEPTION WHEN OTHERS THEN
    -- If there's any error calling the edge function, use a fallback approach
    RAISE WARNING 'Error invoking edge function for embeddings: %', SQLERRM;
    
    -- Generate a deterministic embedding based on input hash as fallback
    WITH hash_input AS (
      SELECT md5(input) as hash_val
    )
    SELECT
      array_agg(
        (('x' || substring(hash_input.hash_val, (i * 4 + 1)::int, 8))::bit(32)::bigint)::float / 4294967295.0 
        - 0.5  -- Normalize to range -0.5 to 0.5
      )::vector(1536) INTO embedding_vector
    FROM hash_input, generate_series(0, 191) i;

    -- Store the fallback embedding in cache
    BEGIN
      INSERT INTO public.embedding_cache (query_hash, query_text, embedding, source_model)
      VALUES (cache_key, input, embedding_vector, 'fallback_hash')
      ON CONFLICT (query_hash) 
      DO UPDATE SET 
        embedding = embedding_vector,
        source_model = 'fallback_hash',
        created_at = now();
    EXCEPTION WHEN OTHERS THEN
      -- If embedding_cache table doesn't exist, just continue
      NULL;
    END;
    
    RETURN embedding_vector;
  END;
END;
$$;

-- Ensure embedding_cache table exists and has the right structure
CREATE TABLE IF NOT EXISTS public.embedding_cache (
  query_hash TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  source_model TEXT DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index for cache expiration lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS embedding_cache_created_at_idx ON public.embedding_cache (created_at);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_embeddings(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_embeddings(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_embeddings(TEXT) TO authenticated; 