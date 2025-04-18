-- Migration: 20240403_hnsw_vector_indexes.sql

-- Step 1: Truncate the content_representations table to remove all existing data
TRUNCATE TABLE content_representations;

-- Step 2: Update the vector dimension from 1536 to 512
ALTER TABLE content_representations 
ALTER COLUMN embedding TYPE VECTOR(512);

-- Step 3: Drop existing IVFFlat indexes
DROP INDEX IF EXISTS content_representations_embedding_idx;
DROP INDEX IF EXISTS cr_basic_embedding_idx;
DROP INDEX IF EXISTS cr_title_embedding_idx;
DROP INDEX IF EXISTS cr_context_enhanced_embedding_idx;

-- Step 4: Create new HNSW index for all representations
CREATE INDEX content_representations_embedding_idx 
ON content_representations
USING hnsw (embedding vector_l2_ops)
WITH (m = 24, ef_construction = 200);

-- Step 5: Create specialized representation type indexes
CREATE INDEX cr_title_embedding_hnsw_idx
ON content_representations
USING hnsw (embedding vector_l2_ops) 
WHERE representation_type = 'title'
WITH (m = 24, ef_construction = 200);

CREATE INDEX cr_context_enhanced_embedding_hnsw_idx
ON content_representations
USING hnsw (embedding vector_l2_ops) 
WHERE representation_type = 'context_enhanced'
WITH (m = 24, ef_construction = 200);

-- Step 6: Update the store_content_representation function to work with 512-dim vectors
CREATE OR REPLACE FUNCTION store_content_representation(
  p_content_id text, 
  p_content_type text, 
  p_representation_type text, 
  p_embedding_vector vector(512), 
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  representation_id UUID;
BEGIN
  -- Restrict to only title and context_enhanced
  IF p_representation_type NOT IN ('title', 'context_enhanced') THEN
    RAISE EXCEPTION 'Invalid representation type. Only "title" and "context_enhanced" are supported.';
  END IF;

  -- Check if representation already exists
  SELECT id INTO representation_id
  FROM public.content_representations
  WHERE parent_id = p_content_id
    AND content_type = p_content_type
    AND representation_type = p_representation_type;
    
  -- If it exists, update it
  IF representation_id IS NOT NULL THEN
    UPDATE public.content_representations
    SET 
      embedding = p_embedding_vector,
      metadata = COALESCE(p_metadata, '{}'::jsonb)
    WHERE id = representation_id;
    
    RETURN representation_id;
  END IF;
  
  -- Otherwise, insert a new representation
  INSERT INTO public.content_representations (
    parent_id,
    content_type,
    representation_type,
    embedding,
    metadata
  ) VALUES (
    p_content_id,
    p_content_type,
    p_representation_type,
    p_embedding_vector,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO representation_id;
  
  RETURN representation_id;
END;
$$;

-- Step 7: Create a helper function for vector search with customizable ef_search
CREATE OR REPLACE FUNCTION vector_search(
  query_text TEXT,
  query_vector VECTOR(512),
  representation_types TEXT[] DEFAULT ARRAY['context_enhanced'],
  content_types TEXT[] DEFAULT ARRAY['post', 'comment'],
  filter_subreddit TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20,
  ef_search INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  parent_id TEXT,
  content_type TEXT,
  representation_type TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set HNSW search parameter for this query
  SET LOCAL hnsw.ef_search = ef_search;
  
  RETURN QUERY
  SELECT 
    cr.id,
    cr.parent_id,
    cr.content_type,
    cr.representation_type,
    1 - (cr.embedding <-> query_vector) AS similarity,
    cr.metadata
  FROM 
    content_representations cr
  WHERE 
    cr.representation_type = ANY(representation_types)
    AND cr.content_type = ANY(content_types)
    AND (
      filter_subreddit IS NULL 
      OR (
        cr.content_type = 'post' AND EXISTS (
          SELECT 1 FROM reddit_posts 
          WHERE id = cr.parent_id AND subreddit = filter_subreddit
        )
      )
      OR (
        cr.content_type = 'comment' AND EXISTS (
          SELECT 1 FROM reddit_comments c
          JOIN reddit_posts p ON c.post_id = p.id
          WHERE c.id = cr.parent_id AND p.subreddit = filter_subreddit
        )
      )
    )
  ORDER BY 
    cr.embedding <-> query_vector
  LIMIT max_results;
END;
$$;

-- Step 8: Analyze the table to update statistics
ANALYZE content_representations; 