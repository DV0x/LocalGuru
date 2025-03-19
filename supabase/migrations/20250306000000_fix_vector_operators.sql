-- Comprehensive fix for pgvector extension issues
-- Addresses "operator does not exist: public.vector <=> public.vector" error

-- First, ensure the vector extension is properly installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Test if the vector extension is working
DO $$
DECLARE
  result float;
  ext_schema text;
BEGIN
  -- Get the schema where vector is installed
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'vector';
  
  RAISE NOTICE 'Vector extension found in schema: %', ext_schema;
  
  -- Test a simple vector operation to verify
  EXECUTE 'SELECT ''[1,2,3]''::vector <=> ''[4,5,6]''::vector' INTO result;
  RAISE NOTICE 'Vector operation successful, result: %', result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error testing vector extension: %', SQLERRM;
END;
$$;

-- Create a proper match_documents function as recommended by Supabase/LangChain
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SET search_path = 'public, extensions'
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.metadata,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM reddit_posts p
  WHERE p.metadata @> filter
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fix parallel_search function to use correct search path
CREATE OR REPLACE FUNCTION public.parallel_search(
  search_query TEXT,
  query_embedding vector(1536),
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
-- Critical fix: ensure proper search path
SET search_path = 'public, extensions'
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
  
  -- Search in chunk-level embeddings (if the function exists)
  chunk_results AS (
    SELECT 
      c.parent_id AS id,
      c.content_type,
      CASE WHEN c.content_type = 'post' THEN p.title ELSE NULL END AS title,
      c.similarity::DOUBLE PRECISION,
      c.chunk_text AS text_preview,
      TRUE AS is_chunk,
      c.chunk_index,
      CASE 
        WHEN c.content_type = 'comment' THEN p2.title
        ELSE NULL
      END AS parent_title,
      CASE
        WHEN c.content_type = 'post' THEN p.subreddit
        ELSE p2.subreddit
      END AS subreddit
    FROM 
      public.search_content_chunks(query_embedding, similarity_threshold_chunks::FLOAT, 50) c
    LEFT JOIN public.reddit_posts p ON c.content_type = 'post' AND c.parent_id = p.id
    LEFT JOIN public.reddit_comments cm ON c.content_type = 'comment' AND c.parent_id = cm.id
    LEFT JOIN public.reddit_posts p2 ON cm.post_id = p2.id
    WHERE EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'search_content_chunks' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    )
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
    WHERE EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'search_content_chunks' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    )
  ) combined
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Also fix search_posts_by_embedding function
CREATE OR REPLACE FUNCTION public.search_posts_by_embedding(
  query_embedding vector(1536),
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
-- Critical fix: ensure proper search path
SET search_path = 'public, extensions'
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

-- Create a simple test function that we can call to verify everything works
CREATE OR REPLACE FUNCTION public.test_vector_search(query text)
RETURNS TABLE (
  id text,
  similarity float,
  title text,
  preview text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public, extensions'
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- This function assumes you have a function to generate embeddings
  -- In a real application, you would call your embedding API here
  -- For testing purposes, we'll just use a dummy embedding
  query_embedding := '[0.1, 0.2, 0.3]'::vector(1536);
  
  RETURN QUERY
  SELECT 
    p.id,
    1 - (p.embedding <=> query_embedding) as similarity,
    p.title,
    substring(p.content, 1, 100) as preview
  FROM public.reddit_posts p
  ORDER BY p.embedding <=> query_embedding
  LIMIT 3;
END;
$$; 