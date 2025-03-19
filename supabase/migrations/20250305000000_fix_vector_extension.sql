-- Script to fix vector operator schema issues
-- This script addresses the "operator does not exist: public.vector <=> public.vector" error

-- First, let's check where the vector extension is actually installed
DO $$
DECLARE
  schema_name text;
BEGIN
  -- Check if the vector extension exists and get its schema
  SELECT n.nspname INTO schema_name
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'vector';
  
  IF schema_name IS NULL THEN
    RAISE NOTICE 'Vector extension not found. Installing it in the public schema...';
    -- Install the vector extension in the public schema
    CREATE EXTENSION IF NOT EXISTS vector;
    schema_name := 'public';
  ELSE
    RAISE NOTICE 'Vector extension found in schema: %', schema_name;
  END IF;
  
  -- Store the schema name for later use
  PERFORM set_config('app.vector_schema', schema_name, false);
END;
$$;

-- Now update the search functions to be compatible with the identified schema
CREATE OR REPLACE FUNCTION public.parallel_search(
  search_query TEXT,
  query_embedding vector(1536),  -- Generic vector type
  similarity_threshold_docs DOUBLE PRECISION DEFAULT 0.65,
  similarity_threshold_chunks DOUBLE PRECISION DEFAULT 0.7,
  docs_weight DOUBLE PRECISION DEFAULT 0.8,
  max_results INTEGER DEFAULT 15
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  title TEXT,
  similarity DOUBLE PRECISION,
  text_preview TEXT,
  is_chunk BOOLEAN,
  chunk_index INTEGER,
  parent_title TEXT,
  subreddit TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public, extensions'  -- Include both schemas in search path
AS $$
BEGIN
  RETURN QUERY
  
  WITH 
  -- Search in document-level embeddings (posts)
  post_results AS (
    SELECT 
      p.id, 
      'post' AS content_type,
      p.title,
      (1 - (p.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE 
        WHEN length(p.content) > 200 THEN substring(p.content, 1, 200) || '...'
        ELSE p.content
      END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      NULL::TEXT AS parent_title,
      p.subreddit
    FROM public.reddit_posts p
    WHERE 1 - (p.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Search in document-level embeddings (comments)
  comment_results AS (
    SELECT 
      c.id, 
      'comment' AS content_type,
      NULL AS title,
      (1 - (c.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE 
        WHEN length(c.content) > 200 THEN substring(c.content, 1, 200) || '...'
        ELSE c.content
      END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      p.title AS parent_title,
      p.subreddit
    FROM public.reddit_comments c
    JOIN public.reddit_posts p ON c.post_id = p.id
    WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Empty placeholder for chunk results while fixing the main issue
  chunk_results AS (
    SELECT 
      NULL::TEXT AS id,
      NULL::TEXT AS content_type,
      NULL::TEXT AS title,
      NULL::DOUBLE PRECISION AS similarity,
      NULL::TEXT AS text_preview,
      NULL::BOOLEAN AS is_chunk,
      NULL::INTEGER AS chunk_index,
      NULL::TEXT AS parent_title,
      NULL::TEXT AS subreddit
    LIMIT 0
  )
  
  -- Combine and rank results with weighting
  SELECT * FROM (
    -- Document-level results with weight adjustment
    SELECT 
      id, 
      content_type, 
      title, 
      (similarity * docs_weight)::DOUBLE PRECISION AS similarity, 
      text_preview,
      is_chunk,
      chunk_index,
      parent_title,
      subreddit
    FROM post_results
    
    UNION ALL
    
    SELECT 
      id, 
      content_type, 
      title, 
      (similarity * docs_weight)::DOUBLE PRECISION AS similarity, 
      text_preview,
      is_chunk,
      chunk_index,
      parent_title,
      subreddit
    FROM comment_results
    
    UNION ALL
    
    -- Chunk-level results (already weighted in the function)
    SELECT 
      id, 
      content_type, 
      title, 
      similarity, 
      text_preview,
      is_chunk,
      chunk_index,
      parent_title,
      subreddit
    FROM chunk_results
  ) combined
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Update search posts function to use the right search path
CREATE OR REPLACE FUNCTION public.search_posts_by_embedding(
  query_embedding vector(1536),  -- Generic vector type
  similarity_threshold float default 0.7,
  max_results integer default 10,
  filter_subreddit text default null,
  min_score integer default null,
  include_nsfw boolean default false
)
RETURNS TABLE (
  id text,
  subreddit text,
  title text,
  content text,
  author_id text,
  similarity float
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public, extensions'  -- Include both schemas in search path
AS $$
begin
  return query
  select
    p.id,
    p.subreddit,
    p.title,
    p.content,
    p.author_id,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.reddit_posts p
  where 1 - (p.embedding <=> query_embedding) > similarity_threshold
    and (filter_subreddit is null or p.subreddit = filter_subreddit)
    and (min_score is null or p.score >= min_score)
    and (include_nsfw or not p.is_nsfw)
  order by similarity desc
  limit max_results;
end;
$$;

-- Also create a simple version of text_search that doesn't rely on vector search
CREATE OR REPLACE FUNCTION public.text_search_backup(
  search_query TEXT,
  filter_subreddit TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 15
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  title TEXT,
  relevance DOUBLE PRECISION, 
  text_preview TEXT,
  is_chunk BOOLEAN,
  chunk_index INTEGER,
  parent_title TEXT,
  subreddit TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  -- Create search configuration for text search
  RETURN QUERY
  
  WITH 
  -- Search in posts
  post_results AS (
    SELECT 
      p.id, 
      'post' AS content_type,
      p.title,
      ts_rank(to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')), 
              plainto_tsquery('english', search_query))::DOUBLE PRECISION AS relevance,
      CASE 
        WHEN length(p.content) > 200 THEN substring(p.content, 1, 200) || '...'
        ELSE p.content
      END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      NULL::TEXT AS parent_title,
      p.subreddit
    FROM public.reddit_posts p
    WHERE 
      to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')) @@ 
      plainto_tsquery('english', search_query)
      AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
    ORDER BY relevance DESC
    LIMIT 20
  ),
  
  -- Search in comments
  comment_results AS (
    SELECT 
      c.id, 
      'comment' AS content_type,
      NULL AS title,
      ts_rank(to_tsvector('english', c.content), 
              plainto_tsquery('english', search_query))::DOUBLE PRECISION AS relevance,
      CASE 
        WHEN length(c.content) > 200 THEN substring(c.content, 1, 200) || '...'
        ELSE c.content
      END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      p.title AS parent_title,
      p.subreddit
    FROM public.reddit_comments c
    JOIN public.reddit_posts p ON c.post_id = p.id
    WHERE 
      to_tsvector('english', c.content) @@ plainto_tsquery('english', search_query)
      AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
    ORDER BY relevance DESC
    LIMIT 20
  )
  
  -- Combine and rank results
  SELECT * FROM (
    SELECT * FROM post_results
    UNION ALL
    SELECT * FROM comment_results
  ) combined
  ORDER BY relevance DESC
  LIMIT max_results;
END;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.parallel_search TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_posts_by_embedding TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.text_search_backup TO authenticated, anon;

-- Add a comment explaining the issue and fix
COMMENT ON FUNCTION public.parallel_search IS 
'Performs a semantic search across both document-level embeddings. 
NOTE: This is a fixed version that addresses the pgvector schema issue by setting the search_path.';

-- Let everyone know the fix has been applied
DO $$
BEGIN
  RAISE NOTICE '------------------------------------';
  RAISE NOTICE 'Vector functions updated with flexible search path!';
  RAISE NOTICE 'Please try your search queries again.';
  RAISE NOTICE '------------------------------------';
END;
$$; 