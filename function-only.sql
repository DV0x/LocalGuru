-- Create timeout-resilient comment search function
CREATE OR REPLACE FUNCTION public.comment_only_search_with_timeout(
  p_query TEXT,
  p_query_embedding VECTOR(512),
  p_query_intent TEXT DEFAULT 'general',
  p_query_topics TEXT[] DEFAULT '{}',
  p_query_locations TEXT[] DEFAULT '{}',
  p_max_results INTEGER DEFAULT 20,
  p_match_threshold FLOAT DEFAULT 0.6,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3,
  p_ef_search INTEGER DEFAULT 100,
  p_timeout_ms INTEGER DEFAULT 9000
)
RETURNS TABLE (
  id TEXT,
  comment_content TEXT,
  comment_snippet TEXT,
  post_title TEXT,
  post_id TEXT,
  subreddit TEXT,
  author TEXT,
  created_at TIMESTAMPTZ,
  similarity DOUBLE PRECISION,
  match_type TEXT,
  metadata JSONB,
  timed_out BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  timed_out BOOLEAN := FALSE;
  timeout_value TEXT;
BEGIN
  -- Convert timeout value to text and set statement timeout
  timeout_value := p_timeout_ms::TEXT;
  EXECUTE 'SET LOCAL statement_timeout = ' || timeout_value;
  
  -- Try with full search parameters
  BEGIN
    RETURN QUERY
    WITH results AS (
      SELECT
        c.id,
        c.content AS comment_content,
        CASE WHEN length(c.content) > 300 THEN substring(c.content, 1, 300) || '...' ELSE c.content END AS comment_snippet,
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
      CASE WHEN length(c.content) > 300 THEN substring(c.content, 1, 300) || '...' ELSE c.content END AS comment_snippet,
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
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.comment_only_search_with_timeout TO authenticated;
GRANT EXECUTE ON FUNCTION public.comment_only_search_with_timeout TO service_role; 