-- Migration to remove content truncation from search results
-- Description: Updates the current search function to return full content in the snippet field

-- Step 1: Update the timeout-resilient comment search function to return full content
CREATE OR REPLACE FUNCTION public.comment_only_search_with_timeout(
  p_query text, 
  p_query_embedding vector, 
  p_query_intent text DEFAULT 'general'::text, 
  p_query_topics text[] DEFAULT '{}'::text[], 
  p_query_locations text[] DEFAULT '{}'::text[], 
  p_max_results integer DEFAULT 20, 
  p_match_threshold double precision DEFAULT 0.6, 
  p_vector_weight double precision DEFAULT 0.7, 
  p_text_weight double precision DEFAULT 0.3, 
  p_ef_search integer DEFAULT 300,
  p_timeout_ms integer DEFAULT 9000
)
RETURNS TABLE(
  id text, 
  comment_content text, 
  comment_snippet text, 
  post_title text, 
  post_id text, 
  subreddit text, 
  author text, 
  created_at timestamp with time zone, 
  similarity double precision, 
  match_type text, 
  metadata jsonb, 
  timed_out boolean
)
LANGUAGE plpgsql
AS $function$
DECLARE
  timed_out BOOLEAN := FALSE;
  timeout_value TEXT;
BEGIN
  -- Convert timeout value to text and set statement timeout
  timeout_value := p_timeout_ms::TEXT;
  EXECUTE 'SET LOCAL statement_timeout = ' || timeout_value;
  
  -- Explicitly set HNSW search parameter
  EXECUTE 'SET LOCAL hnsw.ef_search = ' || p_ef_search::TEXT;
  
  -- Try with full search parameters
  BEGIN
    RETURN QUERY
    WITH results AS (
      SELECT
        c.id,
        c.content AS comment_content,
        c.content AS comment_snippet, -- Modified to return full content instead of truncated snippet
        p.title AS post_title,
        c.post_id,
        p.subreddit,
        c.author_id AS author,
        c.created_at,
        ((1.0 - (cr.embedding <=> p_query_embedding)) * p_vector_weight + 
        COALESCE(ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query)), 0) * p_text_weight)::DOUBLE PRECISION AS similarity,
        'hybrid' AS match_type,
        JSONB_BUILD_OBJECT(
          'thread_context', JSONB_BUILD_OBJECT(
            'postId', c.post_id,
            'postTitle', p.title
          )
        ) AS metadata,
        FALSE AS timed_out
      FROM
        public.content_representations cr
      JOIN
        public.reddit_comments c ON cr.parent_id = c.id
      LEFT JOIN
        public.reddit_posts p ON c.post_id = p.id
      WHERE
        cr.content_type = 'comment'
        AND cr.representation_type = 'context_enhanced'
        AND ((1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.6
            OR c.search_vector @@ websearch_to_tsquery('english', p_query))
        AND p_ef_search IS NOT NULL
      ORDER BY similarity DESC
      LIMIT p_max_results
    )
    SELECT * FROM results;
  
  -- Use the proper SQLSTATE code for statement timeout (57014 = query_canceled)
  EXCEPTION WHEN SQLSTATE '57014' THEN
    timed_out := TRUE;
    
    -- Fall back to text search only (much faster)
    RETURN QUERY
    SELECT
      c.id,
      c.content AS comment_content,
      c.content AS comment_snippet, -- Modified to return full content instead of truncated snippet
      p.title AS post_title,
      c.post_id,
      p.subreddit,
      c.author_id AS author,
      c.created_at,
      (ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query)))::DOUBLE PRECISION AS similarity,
      'text_only' AS match_type,
      JSONB_BUILD_OBJECT(
        'thread_context', JSONB_BUILD_OBJECT(
          'postId', c.post_id,
          'postTitle', p.title
        )
      ) AS metadata,
      TRUE AS timed_out
    FROM
      public.reddit_comments c
    LEFT JOIN
      public.reddit_posts p ON c.post_id = p.id
    WHERE
      c.search_vector @@ websearch_to_tsquery('english', p_query)
    ORDER BY similarity DESC
    LIMIT p_max_results;
  END;
  
  -- Reset statement timeout
  RESET statement_timeout;
END;
$function$;

-- Add comment explaining the changes
COMMENT ON FUNCTION public.comment_only_search_with_timeout IS 'Timeout-resilient comment search function with fallback to text search - modified to return full content in comment_snippet';

-- Grant permissions to the function (preserving existing permissions)
GRANT EXECUTE ON FUNCTION public.comment_only_search_with_timeout TO anon, authenticated, service_role; 