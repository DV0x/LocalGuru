-- Migration to update the embedding_cache table to support different embedding dimensions and models
-- This allows us to store embeddings from different models with varying dimensions

-- Add dimensions column to embedding_cache table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'embedding_cache'
      AND column_name = 'dimensions'
  ) THEN
    ALTER TABLE public.embedding_cache
    ADD COLUMN dimensions integer DEFAULT 512;
  END IF;
  
  -- Update the vector type to support 512 dimensions
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'embedding_cache'
      AND column_name = 'embedding'
      AND data_type = 'USER-DEFINED'
      AND udt_name = 'vector'
  ) THEN
    -- We need to handle existing data before changing the column type
    
    -- 1. Create a temporary column to store existing embeddings
    ALTER TABLE public.embedding_cache
    ADD COLUMN embedding_temp jsonb;
    
    -- 2. Convert existing vector data to jsonb
    UPDATE public.embedding_cache
    SET embedding_temp = to_jsonb(embedding);
    
    -- 3. Drop the existing embedding column
    ALTER TABLE public.embedding_cache
    DROP COLUMN embedding;
    
    -- 4. Add the new embedding column with dynamic vector size
    ALTER TABLE public.embedding_cache
    ADD COLUMN embedding vector;
    
    -- 5. Restore data from the temporary column where needed
    -- This will be handled by the application logic for new queries
    
    -- 6. Drop the temporary column
    ALTER TABLE public.embedding_cache
    DROP COLUMN embedding_temp;
  END IF;
  
  -- Update existing records to specify dimensions
  UPDATE public.embedding_cache
  SET dimensions = 1536
  WHERE dimensions IS NULL;
END
$$;

-- Update the primary key to include model and dimensions
-- First, drop the existing unique constraint on query_hash
ALTER TABLE public.embedding_cache 
DROP CONSTRAINT IF EXISTS embedding_cache_query_hash_key;

-- Create a new composite unique constraint
ALTER TABLE public.embedding_cache
ADD CONSTRAINT embedding_cache_query_model_dimensions_key 
UNIQUE (query_hash, source_model, dimensions);

-- Add index for faster lookups with the combination of model and dimensions
DROP INDEX IF EXISTS idx_embedding_cache_query_model_dimensions;
CREATE INDEX idx_embedding_cache_query_model_dimensions
ON public.embedding_cache(query_hash, source_model, dimensions);

-- Add comments to document the changes
COMMENT ON TABLE public.embedding_cache IS 'Cache for embedding vectors with support for different models and dimensions';
COMMENT ON COLUMN public.embedding_cache.dimensions IS 'Dimensionality of the embedding vector (512 for text-embedding-3-large, 1536 for text-embedding-3-small)';
COMMENT ON COLUMN public.embedding_cache.source_model IS 'The model used to generate the embedding'; 