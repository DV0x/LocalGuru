-- Migration to fix the ambiguous match_type column reference in hybrid_search
-- This resolves the error: "column reference "match_type" is ambiguous"

-- Create a debug-enabled version of hybrid_search that logs counts at each stage
CREATE OR REPLACE FUNCTION public.hybrid_search_debug(
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
  metadata jsonb,                       -- Additional metadata
  debug_info jsonb                      -- Debug information
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_title_boost float := 1.5;           -- Default boost for title representations
  v_context_boost float := 1.2;         -- Default boost for context_enhanced representations
  search_query tsquery;                 -- Text search query
  v_ef_search_value integer := p_ef_search; -- Store parameter value in a local variable
  
  -- Debug variables
  v_debug_info jsonb := '{}'::jsonb;
  v_post_text_count integer;
  v_comment_text_count integer;
  v_vector_count integer;
  v_combined_count integer;
  v_final_count integer;
  v_original_query text := p_query;
  v_post_match_example text;
  v_vector_similarity_example float;
  v_content_example text;
BEGIN
  -- Store search parameters in debug info
  v_debug_info := jsonb_build_object(
    'original_query', p_query,
    'intent', p_query_intent,
    'topics', p_query_topics,
    'locations', p_query_locations,
    'threshold', p_match_threshold,
    'vector_weight', p_vector_weight,
    'text_weight', p_text_weight
  );

  -- Log query parameters to console
  RAISE NOTICE 'DEBUG: Search query: "%", Intent: %, Topics: %, Locations: %', 
    p_query, p_query_intent, p_query_topics, p_query_locations;

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

  -- Update debug info with boosts
  v_debug_info := v_debug_info || jsonb_build_object(
    'title_boost', v_title_boost,
    'context_boost', v_context_boost
  );

  -- Create text search query from input
  search_query := websearch_to_tsquery('english', p_query);
  RAISE NOTICE 'DEBUG: TSQuery: %', search_query;
  
  -- Use dynamic SQL to set the ef_search parameter
  EXECUTE 'SET LOCAL hnsw.ef_search = ' || v_ef_search_value;
  
  -- First, check what's in our tables
  EXECUTE 'SELECT COUNT(*) FROM public.reddit_posts' INTO v_post_text_count;
  EXECUTE 'SELECT COUNT(*) FROM public.reddit_comments' INTO v_comment_text_count;
  
  RAISE NOTICE 'DEBUG: Total posts in DB: %, Total comments in DB: %', 
    v_post_text_count, v_comment_text_count;
  
  v_debug_info := v_debug_info || jsonb_build_object(
    'total_posts', v_post_text_count,
    'total_comments', v_comment_text_count
  );
  
  -- Check if query matches anything at all with just basic text search
  WITH basic_posts AS (
    SELECT p.title, p.content
    FROM public.reddit_posts p
    WHERE p.search_vector @@ search_query
    LIMIT 1
  )
  SELECT p.title INTO v_post_match_example FROM basic_posts p LIMIT 1;
  
  IF v_post_match_example IS NOT NULL THEN
    RAISE NOTICE 'DEBUG: Found basic text match in posts. Example: %', v_post_match_example;
    v_debug_info := v_debug_info || jsonb_build_object('has_text_matches', true);
  ELSE
    RAISE NOTICE 'DEBUG: No basic text matches found in posts!';
    v_debug_info := v_debug_info || jsonb_build_object('has_text_matches', false);
  END IF;
  
  -- Check topic filtering
  IF array_length(p_query_topics, 1) > 0 THEN
    WITH topic_counts AS (
      SELECT COUNT(*) AS count
      FROM public.content_representations cr
      WHERE cr.metadata->'topics' ?| p_query_topics
    )
    SELECT count INTO v_vector_count FROM topic_counts;
    
    RAISE NOTICE 'DEBUG: Content representations matching topics %: %', 
      p_query_topics, v_vector_count;
      
    v_debug_info := v_debug_info || jsonb_build_object('topic_match_count', v_vector_count);
  END IF;
  
  -- Check direct vector similarity without text filtering
  WITH direct_vector_check AS (
    SELECT 
      (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) AS similarity,
      cr.content_type,
      cr.representation_type
    FROM public.content_representations cr
    WHERE (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) > p_match_threshold * 0.7
    ORDER BY similarity DESC
    LIMIT 1
  )
  SELECT similarity INTO v_vector_similarity_example 
  FROM direct_vector_check
  LIMIT 1;
  
  IF v_vector_similarity_example IS NOT NULL THEN
    RAISE NOTICE 'DEBUG: Found direct vector match with similarity: %', v_vector_similarity_example;
    v_debug_info := v_debug_info || jsonb_build_object(
      'has_vector_matches', true,
      'best_vector_similarity', v_vector_similarity_example
    );
  ELSE
    RAISE NOTICE 'DEBUG: No direct vector matches found above threshold!';
    v_debug_info := v_debug_info || jsonb_build_object('has_vector_matches', false);
  END IF;
  
  -- Hybrid search with each stage tracked
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
        cardinality(p_query_locations) = 0 
        OR p.subreddit ILIKE ANY(p_query_locations)
      )
  ),
  text_search_count AS (
    SELECT COUNT(*) AS count FROM text_search
  ),
  text_search_example AS (
    SELECT ts_content AS content FROM text_search LIMIT 1
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
        cardinality(p_query_topics) = 0 
        OR cr.metadata->'topics' ?| p_query_topics
      )
  ),
  vector_search_count AS (
    SELECT COUNT(*) AS count FROM vector_search
  ),
  vector_search_best AS (
    SELECT vs_vector_score AS score FROM vector_search ORDER BY vs_vector_score DESC LIMIT 1
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
  combined_scores_count AS (
    SELECT COUNT(*) AS count FROM combined_scores
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
  ),
  final_count AS (
    SELECT COUNT(*) AS count FROM deduplicated
  )
  
  -- Get the counts into our variables
  SELECT count INTO v_post_text_count FROM text_search_count;
  SELECT content INTO v_content_example FROM text_search_example;
  SELECT count INTO v_vector_count FROM vector_search_count;
  SELECT score INTO v_vector_similarity_example FROM vector_search_best;
  SELECT count INTO v_combined_count FROM combined_scores_count;
  SELECT count INTO v_final_count FROM final_count;
  
  -- Log the results
  RAISE NOTICE 'DEBUG: Text search found % results', v_post_text_count;
  IF v_content_example IS NOT NULL THEN
    RAISE NOTICE 'DEBUG: First text search result content: %', v_content_example;
  END IF;
  
  RAISE NOTICE 'DEBUG: Vector search found % results', v_vector_count;
  IF v_vector_similarity_example IS NOT NULL THEN
    RAISE NOTICE 'DEBUG: Best vector similarity score: %', v_vector_similarity_example;
  END IF;
  
  RAISE NOTICE 'DEBUG: Combined scores found % results', v_combined_count;
  RAISE NOTICE 'DEBUG: Final deduplicated count: %', v_final_count;
  
  -- Add counts to debug info
  v_debug_info := v_debug_info || jsonb_build_object(
    'text_search_count', v_post_text_count,
    'vector_search_count', v_vector_count,
    'combined_count', v_combined_count,
    'final_count', v_final_count
  );
  
  -- Return final results WITH debug info
  RETURN QUERY
  WITH final_results AS (
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
    LIMIT p_max_results
  )
  SELECT 
    fr.*, 
    v_debug_info AS debug_info
  FROM 
    final_results fr
  UNION ALL
  -- If no results, still return the debug info
  SELECT 
    NULL::text AS id,
    NULL::text AS title,
    NULL::text AS content,
    NULL::text AS content_snippet,
    NULL::text AS url,
    NULL::text AS subreddit,
    NULL::text AS author,
    NULL::text AS content_type,
    NULL::timestamp with time zone AS created_at,
    NULL::double precision AS similarity,
    NULL::text AS match_type,
    NULL::jsonb AS metadata,
    v_debug_info AS debug_info
  WHERE NOT EXISTS (SELECT 1 FROM final_results);
  
  -- Reset the HNSW parameter
  RESET hnsw.ef_search;
END;
$$;

-- Create helper functions to test specific stages of the search
CREATE OR REPLACE FUNCTION public.text_search_debug(
  p_query text
)
RETURNS TABLE(
  id text,
  content_type text,
  content text,
  text_score double precision
)
LANGUAGE sql
AS $$
  SELECT 
    p.id, 
    'post' AS content_type,
    p.content,
    ts_rank_cd(p.search_vector, websearch_to_tsquery('english', p_query)) AS text_score
  FROM 
    public.reddit_posts p
  WHERE 
    p.search_vector @@ websearch_to_tsquery('english', p_query)
  
  UNION ALL
  
  SELECT 
    c.id, 
    'comment' AS content_type,
    c.content,
    ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query)) AS text_score
  FROM 
    public.reddit_comments c
  WHERE 
    c.search_vector @@ websearch_to_tsquery('english', p_query)
  
  ORDER BY text_score DESC
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.vector_search_debug(
  p_query_embedding vector(512),
  p_match_threshold double precision DEFAULT 0.6
)
RETURNS TABLE(
  id text,
  content_type text,
  representation_type text,
  similarity double precision
)
LANGUAGE sql
AS $$
  SELECT 
    cr.parent_id AS id,
    cr.content_type,
    cr.representation_type,
    (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) AS similarity
  FROM 
    public.content_representations cr
  WHERE 
    (1.0 - public.cosine_distance(cr.embedding, p_query_embedding)) > p_match_threshold * 0.7
  ORDER BY 
    similarity DESC
  LIMIT 10;
$$;

-- Add grant for debug functions
GRANT EXECUTE ON FUNCTION public.hybrid_search_debug TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_search_debug TO service_role;
GRANT EXECUTE ON FUNCTION public.text_search_debug TO authenticated;
GRANT EXECUTE ON FUNCTION public.text_search_debug TO service_role;
GRANT EXECUTE ON FUNCTION public.vector_search_debug TO authenticated;
GRANT EXECUTE ON FUNCTION public.vector_search_debug TO service_role; 