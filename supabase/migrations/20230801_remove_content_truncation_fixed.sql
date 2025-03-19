-- Migration to update multi_strategy_search function to remove content truncation
-- This migration removes the 300 character limit on content_snippet

-- First drop the existing function
DROP FUNCTION IF EXISTS public.multi_strategy_search(text, vector, text, text[], text[], integer, double precision);

-- Then recreate it with the modifications
CREATE OR REPLACE FUNCTION public.multi_strategy_search(
  p_query text,
  p_query_embedding vector,
  p_query_intent text,
  p_query_topics text[],
  p_query_locations text[],
  p_max_results integer DEFAULT 20,
  p_match_threshold double precision DEFAULT 0.6
)
RETURNS TABLE(
  id text,
  title text,
  content text,
  content_snippet text,
  url text,
  subreddit text,
  author text,
  content_type text,
  created_at timestamp with time zone,
  similarity double precision,
  match_type text,
  metadata jsonb
) 
LANGUAGE plpgsql
AS $function$
DECLARE
  v_content_boost float := 1.0;
  v_title_boost float := 1.0;
  v_context_boost float := 1.0;
  v_location_boost float := 1.0;
  v_topic_boost float := 1.0;
BEGIN
  -- Set boost factors based on query intent
  -- Enhanced with new intent types and optimized boost values
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
      -- Enhanced boost values for comparison intent
      v_content_boost := 1.3;
      v_title_boost := 1.5;
      v_context_boost := 1.4;
      v_location_boost := 1.2;
      v_topic_boost := 1.6; -- Higher topic boost for comparisons
    WHEN 'experience' THEN
      -- Enhanced boost values for experience intent
      v_content_boost := 1.4;
      v_title_boost := 1.3;
      v_context_boost := 1.6; -- Higher context boost for experiences
      v_location_boost := 1.4;
      v_topic_boost := 1.35;
    -- New intent: local_events
    WHEN 'local_events' THEN
      v_content_boost := 1.3;
      v_title_boost := 1.5; -- Higher title boost for event names
      v_context_boost := 1.3;
      v_location_boost := 1.8; -- Highest location boost for events
      v_topic_boost := 1.4;
    -- New intent: how_to
    WHEN 'how_to' THEN
      v_content_boost := 1.5;
      v_title_boost := 1.6; -- High title boost for instructional content
      v_context_boost := 1.7; -- Very high context boost for instructions
      v_location_boost := 1.1; -- Minimal location boost
      v_topic_boost := 1.7; -- Very high topic boost for instructional content
    -- New intent: discovery
    WHEN 'discovery' THEN
      v_content_boost := 1.4;
      v_title_boost := 1.3;
      v_context_boost := 1.5; -- High context boost for rich discovery
      v_location_boost := 1.3;
      v_topic_boost := 1.5; -- High topic boost for discovery
    ELSE -- general and other intents
      v_content_boost := 1.0;
      v_title_boost := 1.5;
      v_context_boost := 1.2;
      v_location_boost := 1.5;
      v_topic_boost := 1.2;
  END CASE;

  RETURN QUERY
  WITH search_results AS (
    -- Strategy 1: Basic content representation search
    (SELECT 
      cr.parent_id AS result_id,
      c.title AS result_title,
      c.content AS result_content,
      c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
      c.url AS result_url,
      c.subreddit AS result_subreddit,
      c.author AS result_author,
      cr.content_type AS result_content_type,
      cr.created_at AS result_created_at,
      (1.0 - (cr.embedding <=> p_query_embedding)) * v_content_boost AS result_match_score,
      'basic' AS result_match_type,
      cr.metadata AS result_metadata
    FROM 
      public.content_representations cr
    JOIN 
      public.content c ON cr.parent_id = c.id
    WHERE 
      cr.representation_type = 'basic'
      AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.8
    ORDER BY result_match_score DESC
    LIMIT 50)
    
    UNION ALL
    
    -- Strategy 2: Title representation search (for posts)
    (SELECT 
      cr.parent_id AS result_id,
      c.title AS result_title,
      c.content AS result_content,
      c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
      c.url AS result_url,
      c.subreddit AS result_subreddit,
      c.author AS result_author,
      cr.content_type AS result_content_type,
      cr.created_at AS result_created_at,
      (1.0 - (cr.embedding <=> p_query_embedding)) * v_title_boost AS result_match_score,
      'title' AS result_match_type,
      cr.metadata AS result_metadata
    FROM 
      public.content_representations cr
    JOIN 
      public.content c ON cr.parent_id = c.id
    WHERE 
      cr.representation_type = 'title'
      AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.8
    ORDER BY result_match_score DESC
    LIMIT 50)
    
    UNION ALL
    
    -- Strategy 3: Context-enhanced representation search
    (SELECT 
      cr.parent_id AS result_id,
      c.title AS result_title,
      c.content AS result_content,
      c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
      c.url AS result_url,
      c.subreddit AS result_subreddit,
      c.author AS result_author,
      cr.content_type AS result_content_type,
      cr.created_at AS result_created_at,
      (1.0 - (cr.embedding <=> p_query_embedding)) * v_context_boost AS result_match_score,
      'context_enhanced' AS result_match_type,
      cr.metadata AS result_metadata
    FROM 
      public.content_representations cr
    JOIN 
      public.content c ON cr.parent_id = c.id
    WHERE 
      cr.representation_type = 'context_enhanced'
      AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.8
    ORDER BY result_match_score DESC
    LIMIT 50)
    
    UNION ALL
    
    -- Strategy 4: Location-boosted search
    (SELECT 
      cr.parent_id AS result_id,
      c.title AS result_title,
      c.content AS result_content,
      c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
      c.url AS result_url,
      c.subreddit AS result_subreddit,
      c.author AS result_author,
      cr.content_type AS result_content_type,
      cr.created_at AS result_created_at,
      (1.0 - (cr.embedding <=> p_query_embedding)) * v_location_boost AS result_match_score,
      'location_boosted' AS result_match_type,
      cr.metadata AS result_metadata
    FROM 
      public.content_representations cr
    JOIN 
      public.content c ON cr.parent_id = c.id
    WHERE 
      cr.representation_type IN ('basic', 'context_enhanced')
      AND p_query_locations IS NOT NULL
      AND array_length(p_query_locations, 1) > 0
      AND (
        -- Check if location is in metadata locations array
        (cr.metadata->'locations' ?| p_query_locations)
        -- Or check if location appears in subreddit name
        OR (c.subreddit ILIKE ANY(array_append(p_query_locations, '%'||p_query_locations[1]||'%')))
      )
      AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5
    ORDER BY result_match_score DESC
    LIMIT 30)
    
    UNION ALL
    
    -- Strategy 5: Topic-boosted search
    (SELECT 
      cr.parent_id AS result_id,
      c.title AS result_title,
      c.content AS result_content,
      c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
      c.url AS result_url,
      c.subreddit AS result_subreddit,
      c.author AS result_author,
      cr.content_type AS result_content_type,
      cr.created_at AS result_created_at,
      (1.0 - (cr.embedding <=> p_query_embedding)) * v_topic_boost AS result_match_score,
      'topic_boosted' AS result_match_type,
      cr.metadata AS result_metadata
    FROM 
      public.content_representations cr
    JOIN 
      public.content c ON cr.parent_id = c.id
    WHERE 
      cr.representation_type IN ('basic', 'context_enhanced')
      AND p_query_topics IS NOT NULL
      AND array_length(p_query_topics, 1) > 0
      AND (cr.metadata->'topics' ?| p_query_topics)
      AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5
    ORDER BY result_match_score DESC
    LIMIT 30)
    
    /* 
     * Special optimizations for specific intent types
     * These are additional boosts for particular intent-specific patterns
     */
    
    UNION ALL
    
    -- Special optimization for how_to intent: Boost instructional content
    (
      SELECT 
        cr.parent_id AS result_id,
        c.title AS result_title,
        c.content AS result_content,
        c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
        c.url AS result_url,
        c.subreddit AS result_subreddit,
        c.author AS result_author,
        cr.content_type AS result_content_type,
        cr.created_at AS result_created_at,
        (1.0 - (cr.embedding <=> p_query_embedding)) * 1.8 AS result_match_score,
        'intent_specific_how_to' AS result_match_type,
        cr.metadata AS result_metadata
      FROM 
        public.content_representations cr
      JOIN 
        public.content c ON cr.parent_id = c.id
      WHERE 
        p_query_intent = 'how_to'
        AND cr.representation_type IN ('basic', 'context_enhanced')
        AND (
          c.title ILIKE '%how to%' 
          OR c.title ILIKE '%guide%' 
          OR c.title ILIKE '%tutorial%'
          OR c.title ILIKE '%step by step%'
          OR c.title ILIKE '%tips%'
        )
        AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5
      ORDER BY result_match_score DESC
      LIMIT 20
    )
    
    UNION ALL
    
    -- Special optimization for local_events intent: Boost event-related content
    (
      SELECT 
        cr.parent_id AS result_id,
        c.title AS result_title,
        c.content AS result_content,
        c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
        c.url AS result_url,
        c.subreddit AS result_subreddit,
        c.author AS result_author,
        cr.content_type AS result_content_type,
        cr.created_at AS result_created_at,
        (1.0 - (cr.embedding <=> p_query_embedding)) * 1.8 AS result_match_score,
        'intent_specific_events' AS result_match_type,
        cr.metadata AS result_metadata
      FROM 
        public.content_representations cr
      JOIN 
        public.content c ON cr.parent_id = c.id
      WHERE 
        p_query_intent = 'local_events'
        AND cr.representation_type IN ('basic', 'context_enhanced')
        AND (
          c.title ILIKE '%event%' 
          OR c.title ILIKE '%festival%' 
          OR c.title ILIKE '%concert%'
          OR c.title ILIKE '%happening%'
          OR c.title ILIKE '%celebration%'
          OR c.title ILIKE '%this week%'
          OR c.title ILIKE '%this weekend%'
          OR c.title ILIKE '%tonight%'
        )
        AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5
      ORDER BY result_match_score DESC
      LIMIT 20
    )
    
    UNION ALL
    
    -- Special optimization for experience intent: Boost personal experience content
    (
      SELECT 
        cr.parent_id AS result_id,
        c.title AS result_title,
        c.content AS result_content,
        c.content AS result_content_snippet, -- MODIFIED: No truncation, use full content
        c.url AS result_url,
        c.subreddit AS result_subreddit,
        c.author AS result_author,
        cr.content_type AS result_content_type,
        cr.created_at AS result_created_at,
        (1.0 - (cr.embedding <=> p_query_embedding)) * 1.7 AS result_match_score,
        'intent_specific_experience' AS result_match_type,
        cr.metadata AS result_metadata
      FROM 
        public.content_representations cr
      JOIN 
        public.content c ON cr.parent_id = c.id
      WHERE 
        p_query_intent = 'experience'
        AND cr.representation_type IN ('basic', 'context_enhanced')
        AND (
          c.content ILIKE '%I experienced%' 
          OR c.content ILIKE '%my experience%' 
          OR c.content ILIKE '%I tried%'
          OR c.content ILIKE '%I visited%'
          OR c.content ILIKE '%I went to%'
          OR c.content ILIKE '%I attended%'
        )
        AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.5
      ORDER BY result_match_score DESC
      LIMIT 20
    )
  ),
  -- Deduplicate and rank final results
  ranked_results AS (
    SELECT 
      result_id,
      result_title,
      result_content,
      result_content_snippet,
      result_url,
      result_subreddit,
      result_author,
      result_content_type,
      result_created_at,
      result_match_score AS similarity,
      result_match_type,
      result_metadata,
      ROW_NUMBER() OVER (PARTITION BY result_id ORDER BY result_match_score DESC) AS rank
    FROM 
      search_results
  )
  SELECT 
    result_id AS id,
    result_title AS title,
    result_content AS content,
    result_content_snippet AS content_snippet,
    result_url AS url,
    result_subreddit AS subreddit,
    result_author AS author,
    result_content_type AS content_type,
    result_created_at AS created_at,
    similarity,
    result_match_type AS match_type,
    result_metadata AS metadata
  FROM 
    ranked_results
  WHERE 
    rank = 1
  ORDER BY 
    similarity DESC
  LIMIT p_max_results;
END;
$function$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.multi_strategy_search TO anon, authenticated, service_role; 