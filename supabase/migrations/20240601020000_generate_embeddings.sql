-- Create a function to generate embeddings
CREATE OR REPLACE FUNCTION public.generate_embeddings(input TEXT)
RETURNS vector(1536)
LANGUAGE plpgsql
AS $$
DECLARE
  embedding vector(1536);
BEGIN
  -- In a production environment, this would call an API to generate real embeddings
  -- For testing, we'll just generate a fixed pattern vector based on the input
  
  -- Initialize with a fixed array of 1536 small values (all 0.1)
  -- For simplicity avoiding complex normalization logic
  SELECT array_fill(0.1, ARRAY[1536])::vector(1536) INTO embedding;
  
  RETURN embedding;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_embeddings(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_embeddings(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_embeddings(TEXT) TO authenticated; 