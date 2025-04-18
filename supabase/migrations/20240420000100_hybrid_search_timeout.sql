-- Migration to implement timeout handling for hybrid search
-- This ensures search doesn't hang and provides fallback to text search

-- Create function for timeout-resilient hybrid search
CREATE OR REPLACE FUNCTION public.hybrid_search_with_timeout(
  p_query text,                                   -- The user's raw search query
  p_query_embedding vector(512),                  -- 512-dim embedding vector of the query
  p_max_results integer DEFAULT 20,               -- Maximum results to return
  p_timeout_ms integer DEFAULT 1000               -- Timeout in milliseconds
)
RETURNS TABLE(
  id text,                              -- Content ID
  title text,                           -- Title (null for comments)
  content text,                         -- Main content
  content_snippet text,                 -- Snippet for display
  url text,                             -- URL if available
  subreddit text,                       -- Subreddit
  author text,                          -- Author
  content_type text,                    -- 'post' or 'comment'
  created_at timestamp with time zone,  -- Creation date
  similarity double precision,          -- Combined similarity score
  match_type text,                      -- Type of match (title/context_enhanced)
  metadata jsonb,                       -- Additional metadata
  timed_out boolean                     -- Whether the search timed out
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  elapsed_ms int;
  timed_out boolean := false;
BEGIN
  start_time := clock_timestamp();
  
  -- Set statement timeout for this transaction only
  SET LOCAL statement_timeout = p_timeout_ms;
  
  BEGIN
    -- Try full hybrid search first
    RETURN QUERY
    SELECT 
      h.id, h.title, h.content, h.content_snippet,
      h.url, h.subreddit, h.author, h.content_type,
      h.created_at, h.similarity, h.match_type, h.metadata,
      false AS timed_out
    FROM hybrid_search(
      p_query, p_query_embedding, 
      'general', '{}', '{}', 
      p_max_results, 0.6, 0.7, 0.3, 40
    ) h;
  EXCEPTION WHEN statement_timeout THEN
    timed_out := true;
    
    -- Fallback to just text search (faster)
    RETURN QUERY
    WITH text_search AS (
      SELECT 
        p.id AS id,
        p.title,
        p.content,
        CASE WHEN length(p.content) > 300 THEN 
          substring(p.content, 1, 300) || '...' 
        ELSE p.content END AS content_snippet,
        p.url,
        p.subreddit,
        p.author_id AS author,
        'post' AS content_type,
        p.created_at,
        ts_rank_cd(p.search_vector, websearch_to_tsquery('english', p_query)) AS similarity,
        'text_only' AS match_type,
        '{}'::jsonb AS metadata,
        true AS timed_out
      FROM public.reddit_posts p
      WHERE p.search_vector @@ websearch_to_tsquery('english', p_query)
      
      UNION ALL
      
      SELECT 
        c.id AS id,
        '' AS title,
        c.content,
        CASE WHEN length(c.content) > 300 THEN 
          substring(c.content, 1, 300) || '...' 
        ELSE c.content END AS content_snippet,
        '' AS url,
        '' AS subreddit,
        c.author_id AS author,
        'comment' AS content_type,
        c.created_at,
        ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query)) AS similarity,
        'text_only' AS match_type,
        '{}'::jsonb AS metadata,
        true AS timed_out
      FROM public.reddit_comments c
      WHERE c.search_vector @@ websearch_to_tsquery('english', p_query)
    )
    SELECT * FROM text_search
    ORDER BY similarity DESC
    LIMIT p_max_results;
  END;
  
  -- Reset the statement timeout
  RESET statement_timeout;
END;
$$;

-- Add comments to document the function
COMMENT ON FUNCTION public.hybrid_search_with_timeout IS 'Timeout-resilient hybrid search that falls back to text search if the hybrid search times out.';

-- Grant execution permissions to roles
GRANT EXECUTE ON FUNCTION public.hybrid_search_with_timeout TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_search_with_timeout TO service_role; 