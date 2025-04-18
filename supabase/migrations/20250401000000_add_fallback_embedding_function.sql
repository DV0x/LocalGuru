-- Add fallback function for embedding generation when edge function fails
CREATE OR REPLACE FUNCTION public.app_generate_embeddings(query text)
RETURNS vector
LANGUAGE plpgsql
AS $$
DECLARE
  cached_embedding vector;
  cache_key text;
BEGIN
  -- Check cache first
  cache_key := md5(query);
  SELECT embedding INTO cached_embedding 
  FROM embedding_cache 
  WHERE query_hash = cache_key
  ORDER BY created_at DESC LIMIT 1;
  
  -- If found in cache, return it
  IF FOUND THEN
    RETURN cached_embedding;
  END IF;
  
  -- If not found, return a null vector (calling code will handle this)
  RETURN NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.app_generate_embeddings TO anon, authenticated, service_role; 