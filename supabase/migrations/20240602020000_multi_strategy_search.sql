-- multi_strategy_search function that implements the Phase 2 features from the optimization plan
CREATE OR REPLACE FUNCTION public.multi_strategy_search(
  max_results INTEGER,
  search_query TEXT,
  query_intent TEXT DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.6,
  include_metadata BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  subreddit TEXT,
  title TEXT,
  content TEXT,
  author_id TEXT,
  match_type TEXT,
  similarity FLOAT,
  post_id TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
  query_tokens TEXT[];
  boost_factor FLOAT := 1.0;
  is_location_query BOOLEAN := false;
  is_recommendation_query BOOLEAN := false;
BEGIN
  -- Generate embedding for the search query
  query_embedding := public.generate_embeddings(search_query);
  
  -- Basic tokenization for text search
  query_tokens := regexp_split_to_array(lower(search_query), '\s+');
  
  -- Adjust strategy based on intent
  IF query_intent = 'location' THEN
    is_location_query := true;
    boost_factor := 1.5; -- Boost location matches
  ELSIF query_intent = 'recommendation' THEN
    is_recommendation_query := true;
    boost_factor := 1.2; -- Boost recommendation matches
  END IF;

  -- Return combined results from various search methods
  RETURN QUERY
  -- Vector search on posts with adaptive boosting
  SELECT 
    p.id::TEXT,
    'post' AS content_type,
    p.subreddit,
    p.title,
    p.content,
    p.author_id,
    'vector_similarity' AS match_type,
    (1 - (p.embedding <=> query_embedding)) * 
      CASE 
        WHEN is_location_query AND p.subreddit ILIKE '%' || query_tokens[array_length(query_tokens, 1)] || '%' THEN boost_factor
        WHEN is_recommendation_query AND p.title ILIKE '%best%' OR p.title ILIKE '%top%' THEN boost_factor
        ELSE 1.0
      END AS similarity,
    NULL AS post_id,
    CASE WHEN include_metadata THEN
      jsonb_build_object(
        'score', p.score,
        'created_at', p.created_at,
        'is_nsfw', p.is_nsfw
      )
    ELSE NULL
    END AS metadata
  FROM public.reddit_posts p
  WHERE (1 - (p.embedding <=> query_embedding)) > similarity_threshold
  
  UNION ALL
  
  -- Vector search on comments
  SELECT 
    c.id::TEXT,
    'comment' AS content_type,
    NULL AS subreddit,
    '' AS title,
    c.content,
    c.author_id,
    'vector_similarity' AS match_type,
    (1 - (c.embedding <=> query_embedding)) * 
      CASE 
        WHEN is_recommendation_query AND c.content ILIKE '%recommend%' THEN boost_factor
        ELSE 1.0
      END AS similarity,
    c.post_id::TEXT,
    CASE WHEN include_metadata THEN
      jsonb_build_object(
        'score', c.score,
        'created_at', c.created_at
      )
    ELSE NULL
    END AS metadata
  FROM public.reddit_comments c
  WHERE (1 - (c.embedding <=> query_embedding)) > similarity_threshold
  
  -- Add a fallback text search if vector search returns too few results
  UNION ALL
  
  SELECT 
    p.id::TEXT,
    'post' AS content_type,
    p.subreddit,
    p.title,
    p.content,
    p.author_id,
    'text_match_fallback' AS match_type,
    0.5 AS similarity, -- Lower similarity score for text-based matches
    NULL AS post_id,
    CASE WHEN include_metadata THEN
      jsonb_build_object(
        'score', p.score,
        'created_at', p.created_at,
        'is_nsfw', p.is_nsfw
      )
    ELSE NULL
    END AS metadata
  FROM public.reddit_posts p
  WHERE 
    -- Only include in results if good text match but not already matched by vectors
    p.id NOT IN (
      SELECT p2.id 
      FROM public.reddit_posts p2 
      WHERE (1 - (p2.embedding <=> query_embedding)) > similarity_threshold
    )
    -- Text match on title or content
    AND (
      p.title ILIKE '%' || search_query || '%'
      OR p.content ILIKE '%' || search_query || '%'
      -- Match on tokens too
      OR (
        SELECT COUNT(*) FROM unnest(query_tokens) t
        WHERE p.title ILIKE '%' || t || '%' OR p.content ILIKE '%' || t || '%'
      ) >= 2
    )
  
  -- Sort all results by similarity
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Create alias for parallel_search that calls multi_strategy_search for backward compatibility
CREATE OR REPLACE FUNCTION public.parallel_search(
  max_results INTEGER,
  search_query TEXT,
  similarity_threshold_chunks FLOAT DEFAULT 0.5,
  similarity_threshold_docs FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  subreddit TEXT,
  title TEXT,
  content TEXT,
  author_id TEXT,
  match_type TEXT,
  similarity FLOAT,
  post_id TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.content_type,
    r.subreddit,
    r.title,
    r.content,
    r.author_id,
    r.match_type,
    r.similarity,
    r.post_id
  FROM public.multi_strategy_search(
    max_results,
    search_query,
    NULL, -- No intent info
    LEAST(similarity_threshold_chunks, similarity_threshold_docs), -- Use the more permissive threshold
    false -- Don't include metadata
  ) r;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.multi_strategy_search(INTEGER, TEXT, TEXT, FLOAT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.multi_strategy_search(INTEGER, TEXT, TEXT, FLOAT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.multi_strategy_search(INTEGER, TEXT, TEXT, FLOAT, BOOLEAN) TO authenticated;

GRANT EXECUTE ON FUNCTION public.parallel_search(INTEGER, TEXT, FLOAT, FLOAT) TO service_role;
GRANT EXECUTE ON FUNCTION public.parallel_search(INTEGER, TEXT, FLOAT, FLOAT) TO anon;
GRANT EXECUTE ON FUNCTION public.parallel_search(INTEGER, TEXT, FLOAT, FLOAT) TO authenticated; 