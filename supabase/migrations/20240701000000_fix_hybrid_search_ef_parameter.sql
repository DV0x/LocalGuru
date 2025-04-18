-- Migration to fix the hybrid_search function to properly handle p_ef_search parameter
-- This resolves the error: "invalid value for parameter "hnsw.ef_search": "p_ef_search""

-- Create or replace the hybrid_search function with the fixed parameter handling
CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_query text,                                   -- The user's raw search query
  p_query_embedding vector(512),                  -- 512-dim embedding vector of the query
  p_query_intent text DEFAULT 'general',          -- Intent from query analysis
  p_query_topics text[] DEFAULT '{}',             -- Topics from query analysis
  p_query_locations text[] DEFAULT '{}',          -- Locations from query analysis
  p_max_results integer DEFAULT 20,               -- Maximum results to return
  p_match_threshold double precision DEFAULT 0.6, -- Min similarity threshold
  p_vector_weight double precision DEFAULT 0.7,   -- Weight for vector score
  p_text_weight double precision DEFAULT 0.3,     -- Weight for text score
  p_ef_search integer DEFAULT 200                 -- HNSW ef_search parameter
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
  metadata jsonb                        -- Additional metadata
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_title_boost float := 1.5;           -- Default boost for title representations
  v_context_boost float := 1.2;         -- Default boost for context_enhanced representations
  search_query tsquery;                 -- Text search query
  v_ef_search_value integer := p_ef_search; -- Store parameter value in a local variable
BEGIN
  -- Set boost factors based on query intent
  CASE p_query_intent
    WHEN 'recommendation' THEN v_title_boost := 1.8; v_context_boost := 1.2;
    WHEN 'information' THEN v_title_boost := 1.6; v_context_boost := 1.3;
    WHEN 'comparison' THEN v_title_boost := 1.7; v_context_boost := 1.3;
    WHEN 'experience' THEN v_title_boost := 1.4; v_context_boost := 1.5;
    WHEN 'local_events' THEN v_title_boost := 1.6; v_context_boost := 1.2;
    WHEN 'how_to' THEN v_title_boost := 1.5; v_context_boost := 1.6;
    WHEN 'discovery' THEN v_title_boost := 1.8; v_context_boost := 1.1;
    ELSE v_title_boost := 1.5; v_context_boost := 1.2;
  END CASE;

  -- Create text search query from input
  search_query := websearch_to_tsquery('english', p_query);
  
  -- FIX: Use dynamic SQL to set the ef_search parameter
  -- This avoids the issue with parameter interpolation
  EXECUTE 'SET LOCAL hnsw.ef_search = ' || v_ef_search_value;
  
  -- Hybrid search combining text search and vector search
  RETURN QUERY
  WITH text_search AS (
    -- Fast pre-filtering using PostgreSQL full-text search on posts
    SELECT 
      p.id AS parent_id,
      'post' AS content_type,
      p.title,
      p.content,
      p.url,
      p.subreddit,
      p.author_id AS author,
      p.created_at,
      ts_rank_cd(p.search_vector, search_query) AS text_score
    FROM 
      public.reddit_posts p
    WHERE 
      p.search_vector @@ search_query
      AND (
        cardinality(p_query_locations) = 0 
        OR p.subreddit ILIKE ANY(p_query_locations)
      )
      AND (
        p_query_intent != 'how_to'
        OR p.title ILIKE ANY(ARRAY['how to%', '%guide%', '%tutorial%', '%steps%', '%instructions%'])
      )
    
    UNION ALL
    
    -- Fast pre-filtering using PostgreSQL full-text search on comments
    SELECT 
      c.id AS parent_id,
      'comment' AS content_type,
      p.title,  -- Get title from parent post
      c.content,
      p.url,
      p.subreddit,
      c.author_id AS author,
      c.created_at,
      ts_rank_cd(c.search_vector, search_query) AS text_score
    FROM 
      public.reddit_comments c
    JOIN 
      public.reddit_posts p ON c.post_id = p.id
    WHERE 
      c.search_vector @@ search_query
      AND (
        cardinality(p_query_locations) = 0 
        OR p.subreddit ILIKE ANY(p_query_locations)
      )
    
    ORDER BY text_score DESC
    LIMIT 1000  -- Cap the number of text search results
  ),
  
  -- Vector search on pre-filtered results
  vector_search AS (
    SELECT 
      ts.parent_id,
      ts.content_type,
      ts.title,
      ts.content,
      ts.url,
      ts.subreddit,
      ts.author,
      ts.created_at,
      CASE
        WHEN cr.representation_type = 'title' THEN 
          (1.0 - (cr.embedding_512 <=> p_query_embedding)) * v_title_boost
        WHEN cr.representation_type = 'context_enhanced' THEN 
          (1.0 - (cr.embedding_512 <=> p_query_embedding)) * v_context_boost
      END AS vector_score,
      ts.text_score,
      cr.representation_type AS match_type,
      cr.metadata
    FROM 
      text_search ts
    JOIN 
      public.content_representations cr 
      ON ts.parent_id = cr.parent_id 
         AND (
           (ts.content_type = 'post' AND cr.content_type = 'post')
           OR 
           (ts.content_type = 'comment' AND cr.content_type = 'comment')
         )
    WHERE 
      cr.representation_type IN ('title', 'context_enhanced')
      AND cr.embedding_512 IS NOT NULL
      AND (1.0 - (cr.embedding_512 <=> p_query_embedding)) > p_match_threshold * 0.7
      AND (
        cardinality(p_query_topics) = 0 
        OR cr.metadata->'topics' ?| p_query_topics
      )
  ),
  
  -- Combine and score results
  combined_scores AS (
    SELECT
      parent_id,
      content_type,
      title,
      content,
      url, 
      subreddit,
      author,
      created_at,
      vector_score,
      text_score,
      (vector_score * p_vector_weight + text_score * p_text_weight) AS combined_score,
      match_type,
      metadata
    FROM
      vector_search
  ),
  
  -- Deduplicate results (in case of multiple representation matches)
  deduplicated AS (
    SELECT DISTINCT ON (parent_id)
      parent_id,
      content_type,
      title,
      content,
      -- Create a snippet of the content for preview
      CASE 
        WHEN length(content) > 300 THEN substring(content, 1, 300) || '...'
        ELSE content
      END AS content_snippet,
      url,
      subreddit,
      author,
      created_at,
      combined_score AS final_score,
      match_type,
      metadata
    FROM
      combined_scores
    ORDER BY
      parent_id, final_score DESC
  )
  
  -- Return final results
  SELECT 
    parent_id AS id,
    title,
    content,
    content_snippet,
    url,
    subreddit,
    author,
    content_type,
    created_at,
    final_score AS similarity,
    match_type,
    metadata
  FROM 
    deduplicated
  ORDER BY 
    similarity DESC
  LIMIT p_max_results;
  
  -- Reset the HNSW parameter
  RESET hnsw.ef_search;
END;
$$;

-- Update the timed_hybrid_search function to match
CREATE OR REPLACE FUNCTION public.timed_hybrid_search(
  p_query text,                                   -- The user's raw search query
  p_query_embedding vector(512),                  -- 512-dim embedding vector of the query
  p_query_intent text DEFAULT 'general',          -- Intent from query analysis
  p_query_topics text[] DEFAULT '{}',             -- Topics from query analysis
  p_query_locations text[] DEFAULT '{}',          -- Locations from query analysis
  p_max_results integer DEFAULT 20,               -- Maximum results to return
  p_match_threshold double precision DEFAULT 0.6, -- Min similarity threshold
  p_vector_weight double precision DEFAULT 0.7,   -- Weight for vector score
  p_text_weight double precision DEFAULT 0.3,     -- Weight for text score
  p_ef_search integer DEFAULT 200                 -- HNSW ef_search parameter
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
  metadata jsonb                        -- Additional metadata
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set a higher statement timeout just for this function call
  SET LOCAL statement_timeout = '30s';
  
  -- Enable parallel query execution
  SET LOCAL max_parallel_workers_per_gather = 4;
  
  -- Call the hybrid_search function
  RETURN QUERY
  SELECT * FROM public.hybrid_search(
    p_query, 
    p_query_embedding,
    p_query_intent,
    p_query_topics,
    p_query_locations,
    p_max_results,
    p_match_threshold,
    p_vector_weight,
    p_text_weight,
    p_ef_search
  );
END;
$$;

-- Add comments to document the fixes
COMMENT ON FUNCTION public.hybrid_search IS 'Hybrid search function that combines PostgreSQL full-text search with vector similarity search for improved relevance. Fixed to properly handle the hnsw.ef_search parameter.';
COMMENT ON FUNCTION public.timed_hybrid_search IS 'Wrapper for hybrid_search with a 30-second statement timeout to prevent long-running queries. Uses parallel query execution for better performance.';

-- Grant execution permissions to roles (in case they were lost)
GRANT EXECUTE ON FUNCTION public.hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_search TO service_role;
GRANT EXECUTE ON FUNCTION public.timed_hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.timed_hybrid_search TO service_role; 