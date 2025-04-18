-- Migration: Update comment search function with additional parameters
-- Description: Adds vector weight, text weight, and ef_search parameters to comment_only_search function

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.comment_only_search;

-- Updated comment_only_search function to support additional parameters
CREATE OR REPLACE FUNCTION public.comment_only_search(
  p_query TEXT,
  p_query_embedding VECTOR(1536),
  p_query_intent TEXT DEFAULT 'general',
  p_query_topics TEXT[] DEFAULT '{}',
  p_query_locations TEXT[] DEFAULT '{}',
  p_max_results INTEGER DEFAULT 20,
  p_match_threshold FLOAT DEFAULT 0.6,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3,
  p_ef_search INTEGER DEFAULT 200
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
  similarity FLOAT,
  match_type TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_content_boost float := 1.0;
  v_title_boost float := 1.0;
  v_context_boost float := 1.0;
  v_location_boost float := 1.0;
  v_topic_boost float := 1.0;
BEGIN
  -- Set HNSW index parameters using dynamic SQL
  EXECUTE 'SET LOCAL hnsw.ef_search = ' || p_ef_search;

  -- Set boost factors based on query intent
  CASE p_query_intent
    WHEN 'recommendation' THEN
      v_content_boost := 1.0;
      v_title_boost := 1.8;
      v_context_boost := 1.2;
      v_location_boost := 1.7;
      v_topic_boost := 1.3;
    WHEN 'information' THEN
      v_content_boost := 1.5;
      v_title_boost := 1.2;
      v_context_boost := 1.3;
      v_location_boost := 1.5;
      v_topic_boost := 1.2;
    WHEN 'comparison' THEN
      v_content_boost := 1.3;
      v_title_boost := 1.5;
      v_context_boost := 1.4;
      v_location_boost := 1.2;
      v_topic_boost := 1.6;
    WHEN 'experience' THEN
      v_content_boost := 1.4;
      v_title_boost := 1.3;
      v_context_boost := 1.6;
      v_location_boost := 1.4;
      v_topic_boost := 1.35;
    WHEN 'local_events' THEN
      v_content_boost := 1.3;
      v_title_boost := 1.5;
      v_context_boost := 1.3;
      v_location_boost := 1.8;
      v_topic_boost := 1.4;
    WHEN 'how_to' THEN
      v_content_boost := 1.5;
      v_title_boost := 1.6;
      v_context_boost := 1.7;
      v_location_boost := 1.1;
      v_topic_boost := 1.7;
    WHEN 'discovery' THEN
      v_content_boost := 1.4;
      v_title_boost := 1.3;
      v_context_boost := 1.5;
      v_location_boost := 1.3;
      v_topic_boost := 1.5;
    ELSE
      v_content_boost := 1.0;
      v_title_boost := 1.5;
      v_context_boost := 1.2;
      v_location_boost := 1.5;
      v_topic_boost := 1.2;
  END CASE;

  RETURN QUERY
  WITH 
  -- First get all potentially relevant comments with their embeddings
  -- This improves performance by pre-filtering content
  candidate_comments AS (
    SELECT 
      cr.parent_id,
      cr.content_type,
      cr.representation_type,
      cr.created_at,
      cr.metadata,
      (1.0 - (cr.embedding <=> p_query_embedding)) AS embedding_similarity,
      c.title,
      c.content,
      c.url,
      c.subreddit,
      c.author,
      -- Extract post context
      COALESCE(cr.metadata->'thread_context'->>'postId', '') AS post_id,
      COALESCE(cr.metadata->'thread_context'->>'postTitle', '') AS post_title
    FROM 
      public.content_representations cr
    JOIN 
      public.content c ON cr.parent_id = c.id
    WHERE 
      cr.content_type = 'comment'
      AND cr.embedding IS NOT NULL
      AND (
        -- Select high probability matches first
        (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.7
        -- Or direct text match
        OR (c.content ILIKE '%' || p_query || '%')
        -- Or items with matching topics
        OR (p_query_topics IS NOT NULL 
            AND array_length(p_query_topics, 1) > 0 
            AND cr.metadata->'topics' ?| p_query_topics
            AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5)
        -- Or items with matching locations
        OR (p_query_locations IS NOT NULL 
            AND array_length(p_query_locations, 1) > 0 
            AND (
              (cr.metadata->'locations' ?| p_query_locations)
              OR (c.subreddit ILIKE ANY(array_append(p_query_locations, '%'||p_query_locations[1]||'%')))
            )
            AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5)
      )
  ),
  
  -- Apply different search strategies in parallel
  search_results AS (
    -- Strategy 1: Basic content representation with vector weight
    SELECT 
      cc.parent_id AS result_id,
      cc.title AS result_title,
      cc.content AS result_content,
      CASE 
        WHEN length(cc.content) > 300 THEN substring(cc.content, 1, 300) || '...'
        ELSE cc.content
      END AS result_content_snippet,
      cc.url AS result_url,
      cc.subreddit AS result_subreddit,
      cc.author AS result_author,
      cc.content_type AS result_content_type,
      cc.created_at AS result_created_at,
      cc.post_id AS result_post_id,
      cc.post_title AS result_post_title,
      cc.embedding_similarity * v_content_boost * p_vector_weight AS result_match_score,
      'basic' AS result_match_type,
      cc.metadata AS result_metadata
    FROM 
      candidate_comments cc
    WHERE 
      cc.representation_type = 'basic'
      AND cc.embedding_similarity > p_match_threshold * 0.8
    
    UNION ALL
    
    -- Strategy 2: Context-enhanced representation with vector weight
    SELECT 
      cc.parent_id AS result_id,
      cc.title AS result_title,
      cc.content AS result_content,
      CASE 
        WHEN length(cc.content) > 300 THEN substring(cc.content, 1, 300) || '...'
        ELSE cc.content
      END AS result_content_snippet,
      cc.url AS result_url,
      cc.subreddit AS result_subreddit,
      cc.author AS result_author,
      cc.content_type AS result_content_type,
      cc.created_at AS result_created_at,
      cc.post_id AS result_post_id,
      cc.post_title AS result_post_title,
      cc.embedding_similarity * v_context_boost * p_vector_weight AS result_match_score,
      'context_enhanced' AS result_match_type,
      cc.metadata AS result_metadata
    FROM 
      candidate_comments cc
    WHERE 
      cc.representation_type = 'context_enhanced'
      AND cc.embedding_similarity > p_match_threshold * 0.7
    
    UNION ALL
    
    -- Strategy 3: Location-boosted search with vector weight
    SELECT 
      cc.parent_id AS result_id,
      cc.title AS result_title,
      cc.content AS result_content,
      CASE 
        WHEN length(cc.content) > 300 THEN substring(cc.content, 1, 300) || '...'
        ELSE cc.content
      END AS result_content_snippet,
      cc.url AS result_url,
      cc.subreddit AS result_subreddit,
      cc.author AS result_author,
      cc.content_type AS result_content_type,
      cc.created_at AS result_created_at,
      cc.post_id AS result_post_id,
      cc.post_title AS result_post_title,
      cc.embedding_similarity * v_location_boost * p_vector_weight AS result_match_score,
      'location_boosted' AS result_match_type,
      cc.metadata AS result_metadata
    FROM 
      candidate_comments cc
    WHERE 
      cc.representation_type IN ('basic', 'context_enhanced')
      AND p_query_locations IS NOT NULL
      AND array_length(p_query_locations, 1) > 0
      AND (
        (cc.metadata->'locations' ?| p_query_locations)
        OR (cc.subreddit ILIKE ANY(array_append(p_query_locations, '%'||p_query_locations[1]||'%')))
      )
      AND cc.embedding_similarity > p_match_threshold * 0.5
    
    UNION ALL
    
    -- Strategy 4: Topic-boosted search with vector weight
    SELECT 
      cc.parent_id AS result_id,
      cc.title AS result_title,
      cc.content AS result_content,
      CASE 
        WHEN length(cc.content) > 300 THEN substring(cc.content, 1, 300) || '...'
        ELSE cc.content
      END AS result_content_snippet,
      cc.url AS result_url,
      cc.subreddit AS result_subreddit,
      cc.author AS result_author,
      cc.content_type AS result_content_type,
      cc.created_at AS result_created_at,
      cc.post_id AS result_post_id,
      cc.post_title AS result_post_title,
      cc.embedding_similarity * v_topic_boost * p_vector_weight AS result_match_score,
      'topic_boosted' AS result_match_type,
      cc.metadata AS result_metadata
    FROM 
      candidate_comments cc
    WHERE 
      cc.representation_type IN ('basic', 'context_enhanced')
      AND p_query_topics IS NOT NULL
      AND array_length(p_query_topics, 1) > 0
      AND (cc.metadata->'topics' ?| p_query_topics)
      AND cc.embedding_similarity > p_match_threshold * 0.5
    
    UNION ALL
    
    -- Strategy 5: Direct text match with text weight
    SELECT 
      cc.parent_id AS result_id,
      cc.title AS result_title,
      cc.content AS result_content,
      CASE 
        WHEN length(cc.content) > 300 THEN substring(cc.content, 1, 300) || '...'
        ELSE cc.content
      END AS result_content_snippet,
      cc.url AS result_url,
      cc.subreddit AS result_subreddit,
      cc.author AS result_author,
      cc.content_type AS result_content_type,
      cc.created_at AS result_created_at,
      cc.post_id AS result_post_id,
      cc.post_title AS result_post_title,
      CASE
        WHEN cc.content ILIKE '%' || p_query || '%' THEN 2.0 * p_text_weight  -- Exact phrase match
        ELSE 1.5 * p_text_weight  -- Partial match
      END AS result_match_score,
      'text_match' AS result_match_type,
      cc.metadata AS result_metadata
    FROM 
      candidate_comments cc
    WHERE cc.content ILIKE '%' || p_query || '%'
  ),
  
  -- Deduplicate results by taking highest score for each content ID
  deduplicated AS (
    SELECT DISTINCT ON (result_id)
      result_id,
      result_title,
      result_content,
      result_content_snippet,
      result_url,
      result_subreddit,
      result_author,
      result_content_type,
      result_created_at,
      result_post_id,
      result_post_title,
      result_match_score,
      result_match_type,
      result_metadata
    FROM search_results
    ORDER BY result_id, result_match_score DESC
  )
  
  -- Return final sorted results and map to the output column names
  SELECT 
    result_id AS id,
    result_content AS comment_content,
    result_content_snippet AS comment_snippet,
    result_post_title AS post_title,
    result_post_id AS post_id,
    result_subreddit AS subreddit,
    result_author AS author,
    result_created_at AS created_at,
    result_match_score AS similarity,
    result_match_type AS match_type,
    result_metadata AS metadata
  FROM deduplicated
  ORDER BY result_match_score DESC
  LIMIT p_max_results;
END;
$$;

-- Add or update the function comment
COMMENT ON FUNCTION public.comment_only_search IS 'Enhanced comment search function supporting configurable weights and HNSW parameters';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.comment_only_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.comment_only_search TO service_role; 