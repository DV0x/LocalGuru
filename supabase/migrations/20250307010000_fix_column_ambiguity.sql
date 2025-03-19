-- Fix the parallel_search function to resolve column ambiguity
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
      p.id AS id,
      'post' AS content_type,
      p.title AS title,
      (1 - (p.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE WHEN length(p.content) > 200 THEN substring(p.content, 1, 200) || '...' ELSE p.content END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      NULL::TEXT AS parent_title,
      p.subreddit AS subreddit
    FROM public.reddit_posts p
    WHERE 1 - (p.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  ),
  comment_results AS (
    SELECT
      c.id AS id,
      'comment' AS content_type,
      NULL AS title,
      (1 - (c.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE WHEN length(c.content) > 200 THEN substring(c.content, 1, 200) || '...' ELSE c.content END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      p.title AS parent_title,
      p.subreddit AS subreddit
    FROM public.reddit_comments c
    JOIN public.reddit_posts p ON c.post_id = p.id
    WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  )
  SELECT * FROM (
    SELECT
      pr.id AS id,
      pr.content_type AS content_type,
      pr.title AS title,
      (pr.similarity * docs_weight)::DOUBLE PRECISION AS similarity,
      pr.text_preview AS text_preview,
      pr.is_chunk AS is_chunk,
      pr.chunk_index AS chunk_index,
      pr.parent_title AS parent_title,
      pr.subreddit AS subreddit
    FROM post_results pr
    UNION ALL
    SELECT
      cr.id AS id,
      cr.content_type AS content_type,
      cr.title AS title,
      (cr.similarity * docs_weight)::DOUBLE PRECISION AS similarity,
      cr.text_preview AS text_preview,
      cr.is_chunk AS is_chunk,
      cr.chunk_index AS chunk_index,
      cr.parent_title AS parent_title,
      cr.subreddit AS subreddit
    FROM comment_results cr
  ) combined
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$func$;

-- Fix the search_posts_by_embedding function to be more explicit
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
    p.id AS id,
    p.subreddit AS subreddit,
    p.title AS title,
    p.content AS content,
    p.author_id AS author_id,
    (1 - (p.embedding <=> query_embedding)) AS similarity
  FROM public.reddit_posts p
  WHERE (1 - (p.embedding <=> query_embedding)) > similarity_threshold
    AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
    AND (min_score IS NULL OR p.score >= min_score)
    AND (include_nsfw OR NOT p.is_nsfw)
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$func$; 