-- Update the parallel_search function to include content_chunks table in search
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
  ),
  chunk_results AS (
    SELECT
      ck.id AS id,
      ck.content_type AS content_type,
      NULL AS title,
      (1 - (ck.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE WHEN length(ck.chunk_text) > 200 THEN substring(ck.chunk_text, 1, 200) || '...' ELSE ck.chunk_text END AS text_preview,
      TRUE AS is_chunk,
      ck.chunk_index AS chunk_index,
      CASE 
        WHEN ck.content_type = 'post' THEN (SELECT p.title FROM public.reddit_posts p WHERE p.id = ck.parent_id)
        WHEN ck.content_type = 'comment' THEN (
          SELECT p.title 
          FROM public.reddit_posts p 
          JOIN public.reddit_comments c ON c.post_id = p.id 
          WHERE c.id = ck.parent_id
        )
        ELSE NULL
      END AS parent_title,
      CASE 
        WHEN ck.content_type = 'post' THEN (SELECT p.subreddit FROM public.reddit_posts p WHERE p.id = ck.parent_id)
        WHEN ck.content_type = 'comment' THEN (
          SELECT p.subreddit 
          FROM public.reddit_posts p 
          JOIN public.reddit_comments c ON c.post_id = p.id 
          WHERE c.id = ck.parent_id
        )
        ELSE NULL
      END AS subreddit
    FROM public.content_chunks ck
    WHERE 1 - (ck.embedding <=> query_embedding) > similarity_threshold_chunks
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
    UNION ALL
    SELECT
      ckr.id AS id,
      ckr.content_type || '_chunk' AS content_type, -- Mark as post_chunk or comment_chunk
      ckr.title AS title,
      ckr.similarity AS similarity, -- Note: Not applying docs_weight to chunks
      ckr.text_preview AS text_preview,
      ckr.is_chunk AS is_chunk,
      ckr.chunk_index AS chunk_index,
      ckr.parent_title AS parent_title,
      ckr.subreddit AS subreddit
    FROM chunk_results ckr
  ) combined
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$func$; 