-- Migration to create optimized HNSW indexes for comment search
-- This is separated from function creation to avoid gateway timeouts

-- Increase statement timeout temporarily for this migration (60 minutes)
ALTER DATABASE postgres SET statement_timeout = '3600000';

-- Drop existing indexes for clean recreation
DROP INDEX IF EXISTS content_representations_embedding_idx;
DROP INDEX IF EXISTS cr_context_enhanced_embedding_hnsw_idx;

-- Create the primary HNSW index with optimized parameters
DO $$
BEGIN
  EXECUTE '
    CREATE INDEX content_representations_embedding_idx 
    ON content_representations
    USING hnsw(embedding vector_l2_ops)
    WITH (m=32, ef_construction=400)
  ';
END
$$;

-- Create specialized HNSW index for context_enhanced representations
DO $$
BEGIN
  EXECUTE '
    CREATE INDEX cr_context_enhanced_embedding_hnsw_idx 
    ON content_representations
    USING hnsw(embedding vector_l2_ops) 
    WHERE representation_type = ''context_enhanced''
    WITH (m=32, ef_construction=400)
  ';
END
$$;

-- Set ef_search parameter for HNSW index (if supported)
DO $$
BEGIN
  BEGIN
    SET hnsw.ef_search = 400;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END$$;

-- Analyze the tables for optimizer statistics
ANALYZE public.content_representations;

-- Reset statement timeout to a reasonable default (30 seconds)
ALTER DATABASE postgres SET statement_timeout = '30000'; 