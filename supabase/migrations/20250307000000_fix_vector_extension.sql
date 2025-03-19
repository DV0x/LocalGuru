-- Create the vector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Make sure the extension config is properly set up
ALTER EXTENSION vector UPDATE;

-- Create or replace the parallel_search function
CREATE OR REPLACE FUNCTION public.parallel_search(
  search_query TEXT,
  query_embedding public.vector(1536),
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
AS $func$
BEGIN
  RETURN QUERY
  WITH post_results AS (
    SELECT
      p.id,
      'post' AS content_type,
      p.title,
      (1 - (p.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE WHEN length(p.content) > 200 THEN substring(p.content, 1, 200) || '...' ELSE p.content END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      NULL::TEXT AS parent_title,
      p.subreddit
    FROM public.reddit_posts p
    WHERE 1 - (p.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  ),
  comment_results AS (
    SELECT
      c.id,
      'comment' AS content_type,
      NULL AS title,
      (1 - (c.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE WHEN length(c.content) > 200 THEN substring(c.content, 1, 200) || '...' ELSE c.content END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      p.title AS parent_title,
      p.subreddit
    FROM public.reddit_comments c
    JOIN public.reddit_posts p ON c.post_id = p.id
    WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  )
  SELECT * FROM (
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
  ) combined
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$func$;

-- Create or replace the search_posts_by_embedding function
CREATE OR REPLACE FUNCTION public.search_posts_by_embedding(
  query_embedding public.vector(1536),
  similarity_threshold float DEFAULT 0.7,
  max_results integer DEFAULT 10,
  filter_subreddit text DEFAULT NULL,
  min_score integer DEFAULT NULL,
  include_nsfw boolean DEFAULT FALSE
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
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.subreddit,
    p.title,
    p.content,
    p.author_id,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.reddit_posts p
  WHERE 1 - (p.embedding <=> query_embedding) > similarity_threshold
    AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
    AND (min_score IS NULL OR p.score >= min_score)
    AND (include_nsfw OR NOT p.is_nsfw)
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$func$; 