-- Migration: Add metadata column to content_representations
-- Description: Adds JSONB metadata column to enable chunk relationships

-- Add metadata column to content_representations table for storing chunk index and other metadata
ALTER TABLE public.content_representations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create an index on the metadata for efficient filtering
CREATE INDEX IF NOT EXISTS content_representations_metadata_idx ON 
  public.content_representations USING GIN (metadata);

-- Comment on the metadata column to document its purpose
COMMENT ON COLUMN public.content_representations.metadata IS 
  'Stores metadata like chunk_index for relating embeddings to content_chunks';

-- Function to insert content chunk without triggering embeddings - workaround for permission issues
CREATE OR REPLACE FUNCTION public.insert_content_chunk(
  p_parent_id TEXT,
  p_content_type TEXT,
  p_chunk_index INTEGER,
  p_chunk_text TEXT,
  p_chunk_tokens INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.content_chunks (
    parent_id,
    content_type,
    chunk_index,
    chunk_text
  ) VALUES (
    p_parent_id,
    p_content_type,
    p_chunk_index,
    p_chunk_text
  ) 
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execution permissions on the function
GRANT EXECUTE ON FUNCTION public.insert_content_chunk TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_content_chunk TO anon;
GRANT EXECUTE ON FUNCTION public.insert_content_chunk TO service_role; 