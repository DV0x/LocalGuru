-- Migration to fix location filtering in hybrid_search function
-- This changes location filtering to look at content and metadata instead of subreddits

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
SECURITY INVOKER
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
  
  -- Use dynamic SQL to set the ef_search parameter
  EXECUTE 'SET LOCAL hnsw.ef_search = ' || v_ef_search_value;
  
  -- Hybrid search combining text search and vector search
  RETURN QUERY
  WITH text_search AS (
    -- Fast pre-filtering using PostgreSQL full-text search on posts
    SELECT 
      p.id AS ts_parent_id,
      'post' AS ts_content_type,
      p.title AS ts_title,
      p.content AS ts_content,
      p.url AS ts_url,
      p.subreddit AS ts_subreddit,
      p.author_id AS ts_author,
      p.created_at AS ts_created_at,
      ts_rank_cd(p.search_vector, search_query) AS ts_text_score
    FROM 
      public.reddit_posts p
    WHERE 
      p.search_vector @@ search_query
      AND (
        -- NEW LOCATION FILTERING LOGIC
        -- Either no locations specified, or content contains these locations
        cardinality(p_query_locations) = 0 
        OR (
          -- Check if any location is mentioned in the content 
          EXISTS (
            SELECT 1 FROM unnest(p_query_locations) AS loc
            WHERE 
              p.content ILIKE '%' || loc || '%'
              OR p.title ILIKE '%' || loc || '%'
          )
        )
      )
      AND (
        p_query_intent != 'how_to'
        OR p.title ILIKE ANY(ARRAY['how to%', '%guide%', '%tutorial%', '%steps%', '%instructions%'])
      )
    
    UNION ALL
    
    -- Fast pre-filtering using PostgreSQL full-text search on comments
    SELECT 
      c.id AS ts_parent_id,
      'comment' AS ts_content_type,
      p.title AS ts_title,
      c.content AS ts_content,
      p.url AS ts_url,
      p.subreddit AS ts_subreddit,
      c.author_id AS ts_author,
      c.created_at AS ts_created_at,
      ts_rank_cd(c.search_vector, search_query) AS ts_text_score
    FROM 
      public.reddit_comments c
    JOIN 
      public.reddit_posts p ON c.post_id = p.id
    WHERE 
      c.search_vector @@ search_query
      AND (
        -- NEW LOCATION FILTERING LOGIC
        -- Either no locations specified, or content contains these locations
        cardinality(p_query_locations) = 0 
        OR (
          -- Check if any location is mentioned in the content
          EXISTS (
            SELECT 1 FROM unnest(p_query_locations) AS loc
            WHERE c.content ILIKE '%' || loc || '%'
          )
        )
      )
    
    ORDER BY ts_text_score DESC
    LIMIT 1000  -- Cap the number of text search results
  ),
  
  -- Vector search on pre-filtered results
  vector_search AS (
    SELECT 
      ts.ts_parent_id AS vs_parent_id,
      ts.ts_content_type AS vs_content_type,
      ts.ts_title AS vs_title,
      ts.ts_content AS vs_content,
      ts.ts_url AS vs_url,
      ts.ts_subreddit AS vs_subreddit,
      ts.ts_author AS vs_author,
      ts.ts_created_at AS vs_created_at,
      CASE
        WHEN cr.representation_type = 'title' THEN 
          (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) * v_title_boost
        WHEN cr.representation_type = 'context_enhanced' THEN 
          (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) * v_context_boost
        ELSE
          (1.0 - public.cosine_distance(cr.embedding, p_query_embedding))
      END AS vs_vector_score,
      ts.ts_text_score AS vs_text_score,
      cr.representation_type AS vs_match_type,
      cr.metadata AS vs_metadata
    FROM 
      text_search ts
    JOIN 
      public.content_representations cr 
      ON ts.ts_parent_id = cr.parent_id
         AND (
           (ts.ts_content_type = 'post' AND cr.content_type = 'post')
           OR 
           (ts.ts_content_type = 'comment' AND cr.content_type = 'comment')
         )
    WHERE 
      cr.representation_type IN ('title', 'context_enhanced')
      AND cr.embedding IS NOT NULL
      AND (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) > p_match_threshold * 0.7
      AND (
        -- Topic filtering now combined with additional location metadata check
        (
          cardinality(p_query_topics) = 0 
          OR cr.metadata->'topics' ?| p_query_topics
        )
        AND (
          -- NEW LOCATION METADATA FILTERING
          -- Also check if locations are in metadata if they didn't match in content
          cardinality(p_query_locations) = 0
          OR cr.metadata->'locations' ?| p_query_locations
        )
      )
  ),
  
  -- Combine and score results
  combined_scores AS (
    SELECT
      vs.vs_parent_id AS cs_parent_id,
      vs.vs_content_type AS cs_content_type,
      vs.vs_title AS cs_title,
      vs.vs_content AS cs_content,
      vs.vs_url AS cs_url,
      vs.vs_subreddit AS cs_subreddit,
      vs.vs_author AS cs_author,
      vs.vs_created_at AS cs_created_at,
      vs.vs_vector_score AS cs_vector_score,
      vs.vs_text_score AS cs_text_score,
      (vs.vs_vector_score * p_vector_weight + vs.vs_text_score * p_text_weight) AS cs_combined_score,
      vs.vs_match_type AS cs_match_type,
      vs.vs_metadata AS cs_metadata
    FROM
      vector_search vs
  ),
  
  -- Deduplicate results (in case of multiple representation matches)
  deduplicated AS (
    SELECT DISTINCT ON (cs.cs_parent_id)
      cs.cs_parent_id,
      cs.cs_content_type,
      cs.cs_title,
      cs.cs_content,
      -- Create a snippet of the content for preview
      CASE 
        WHEN length(cs.cs_content) > 300 THEN substring(cs.cs_content, 1, 300) || '...'
        ELSE cs.cs_content
      END AS dd_content_snippet,
      cs.cs_url,
      cs.cs_subreddit,
      cs.cs_author,
      cs.cs_created_at,
      cs.cs_combined_score AS dd_final_score,
      cs.cs_match_type AS dd_match_type,
      cs.cs_metadata AS dd_metadata
    FROM
      combined_scores cs
    ORDER BY
      cs.cs_parent_id, cs.cs_combined_score DESC
  )
  
  -- Return final results
  SELECT 
    dd.cs_parent_id AS id,
    dd.cs_title AS title,
    dd.cs_content AS content,
    dd.dd_content_snippet AS content_snippet,
    dd.cs_url AS url,
    dd.cs_subreddit AS subreddit,
    dd.cs_author AS author,
    dd.cs_content_type AS content_type,
    dd.cs_created_at AS created_at,
    dd.dd_final_score AS similarity,
    dd.dd_match_type AS match_type,
    dd.dd_metadata AS metadata
  FROM 
    deduplicated dd
  ORDER BY 
    dd.dd_final_score DESC
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
SECURITY INVOKER
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
COMMENT ON FUNCTION public.hybrid_search IS 'Hybrid search function that combines PostgreSQL full-text search with vector similarity search. Filtering now looks for locations in content and metadata rather than just in subreddit names.';
COMMENT ON FUNCTION public.timed_hybrid_search IS 'Wrapper for hybrid_search with a 30-second statement timeout to prevent long-running queries. Uses parallel query execution for better performance.';

-- Grant execution permissions to roles
GRANT EXECUTE ON FUNCTION public.hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_search TO service_role;
GRANT EXECUTE ON FUNCTION public.timed_hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.timed_hybrid_search TO service_role; 