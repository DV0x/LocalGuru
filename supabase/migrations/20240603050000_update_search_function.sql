-- Update the search_content_multi_strategy function to work with our new approach
DROP FUNCTION IF EXISTS public.search_content_multi_strategy(TEXT, public.vector(1536), JSONB, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.search_content_multi_strategy(
  query TEXT,
  query_embedding public.vector(1536) DEFAULT NULL,
  analysis JSONB DEFAULT NULL,
  max_results INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0,
  subreddits TEXT[] DEFAULT NULL,
  metadata_boost BOOLEAN DEFAULT TRUE,
  use_fallback BOOLEAN DEFAULT TRUE,
  debug BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  id TEXT, 
  title TEXT, 
  content TEXT, 
  content_snippet TEXT, 
  url TEXT, 
  subreddit TEXT, 
  author TEXT, 
  content_type TEXT, 
  created_at TIMESTAMP WITH TIME ZONE, 
  match_score DOUBLE PRECISION, 
  match_type TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  embedding_vector public.vector(1536);
  generated_embedding BOOLEAN;
  search_intent TEXT;
  search_topics TEXT[];
  search_locations TEXT[];
  search_entities TEXT[];
  content_boost FLOAT;
  title_boost FLOAT;
  context_boost FLOAT;
  location_boost FLOAT;
  entity_boost FLOAT;
  topic_boost FLOAT;
  match_threshold FLOAT;
  min_results INT;
  query_normalized TEXT;
BEGIN
  -- Normalize query
  query_normalized := trim(lower(query));
  
  -- Generate embeddings if not provided
  generated_embedding := FALSE;
  IF query_embedding IS NULL THEN
    SELECT public.generate_embeddings(query) INTO embedding_vector;
    generated_embedding := TRUE;
  ELSE
    embedding_vector := query_embedding::public.vector(1536);
  END IF;
  
  -- Extract analysis data if available
  IF analysis IS NOT NULL THEN
    search_intent := analysis->>'intent';
    search_topics := array_remove(ARRAY(SELECT jsonb_array_elements_text(analysis->'topics')), NULL);
    search_locations := array_remove(ARRAY(SELECT jsonb_array_elements_text(analysis->'locations')), NULL);
    search_entities := array_remove(ARRAY(
      SELECT jsonb_array_elements_text(entities.value)
      FROM jsonb_each(analysis->'entities') entities
    ), NULL);
  ELSE
    search_intent := 'general';
    search_topics := ARRAY[]::TEXT[];
    search_locations := ARRAY[]::TEXT[];
    search_entities := ARRAY[]::TEXT[];
  END IF;
  
  -- Set strategy parameters based on query intent
  CASE search_intent
    WHEN 'recommendation' THEN
      content_boost := 1.0;
      title_boost := 1.8;
      context_boost := 1.2;
      location_boost := 1.7;
      entity_boost := 1.5;
      topic_boost := 1.3;
      match_threshold := 0.6;
      min_results := 7;
    WHEN 'information' THEN
      content_boost := 1.5;
      title_boost := 1.2;
      context_boost := 1.3;
      location_boost := 1.5;
      entity_boost := 1.6;
      topic_boost := 1.2;
      match_threshold := 0.65;
      min_results := 5;
    WHEN 'comparison' THEN
      content_boost := 1.3;
      title_boost := 1.5;
      context_boost := 1.4;
      location_boost := 1.2;
      entity_boost := 1.7;
      topic_boost := 1.5;
      match_threshold := 0.63;
      min_results := 6;
    WHEN 'experience' THEN
      content_boost := 1.4;
      title_boost := 1.3;
      context_boost := 1.5;
      location_boost := 1.4;
      entity_boost := 1.3;
      topic_boost := 1.2;
      match_threshold := 0.58;
      min_results := 8;
    ELSE
      content_boost := 1.0;
      title_boost := 1.5;
      context_boost := 1.2;
      location_boost := 1.5;
      entity_boost := 1.5;
      topic_boost := 1.2;
      match_threshold := 0.62;
      min_results := 5;
  END CASE;
  
  -- Begin with the multi-strategy search across different representations
  RETURN QUERY
  WITH result_candidates AS (
    -- STRATEGY 1: Full Content Embeddings
    (SELECT 
      c.content_id as id,
      c.title,
      c.content,
      substring(c.content, 1, 300) as content_snippet,
      c.url,
      c.subreddit,
      c.author,
      c.content_type,
      to_timestamp(c.created_utc) as created_at,
      (1.0 - (c.content_embedding <=> embedding_vector)) * content_boost as match_score,
      'content' as match_type,
      (1.0 - (c.content_embedding <=> embedding_vector)) * content_boost AS score
    FROM public.content_representations c
    WHERE 
      c.content_embedding IS NOT NULL
      AND (1.0 - (c.content_embedding <=> embedding_vector)) > match_threshold
      AND (subreddits IS NULL OR c.subreddit = ANY(subreddits))
    ORDER BY score DESC
    LIMIT 50)
    
    UNION
    
    -- STRATEGY 2: Title Embeddings (weighted higher for recommendation queries)
    (SELECT 
      c.content_id as id,
      c.title,
      c.content,
      substring(c.content, 1, 300) as content_snippet,
      c.url,
      c.subreddit,
      c.author,
      c.content_type,
      to_timestamp(c.created_utc) as created_at,
      (1.0 - (c.title_embedding <=> embedding_vector)) * title_boost as match_score,
      'title' as match_type,
      (1.0 - (c.title_embedding <=> embedding_vector)) * title_boost AS score
    FROM public.content_representations c
    WHERE 
      c.title_embedding IS NOT NULL
      AND (1.0 - (c.title_embedding <=> embedding_vector)) > match_threshold
      AND (subreddits IS NULL OR c.subreddit = ANY(subreddits))
    ORDER BY score DESC
    LIMIT 50)
    
    UNION
    
    -- STRATEGY 3: Context-Enhanced Embeddings (weighted higher for experience and comparison queries)
    (SELECT 
      c.content_id as id,
      c.title,
      c.content,
      substring(c.content, 1, 300) as content_snippet,
      c.url,
      c.subreddit,
      c.author,
      c.content_type,
      to_timestamp(c.created_utc) as created_at,
      (1.0 - (c.context_embedding <=> embedding_vector)) * context_boost as match_score,
      'context' as match_type,
      (1.0 - (c.context_embedding <=> embedding_vector)) * context_boost AS score
    FROM public.content_representations c
    WHERE 
      c.context_embedding IS NOT NULL
      AND (1.0 - (c.context_embedding <=> embedding_vector)) > match_threshold
      AND (subreddits IS NULL OR c.subreddit = ANY(subreddits))
    ORDER BY score DESC
    LIMIT 50)
    
    -- STRATEGY 4: Metadata-Boosted Results (if enabled)
    UNION
    
    (
      SELECT 
        c.content_id as id,
        c.title,
        c.content,
        substring(c.content, 1, 300) as content_snippet,
        c.url,
        c.subreddit,
        c.author,
        c.content_type,
        to_timestamp(c.created_utc) as created_at,
        (1.0 - (c.content_embedding <=> embedding_vector)) * 
          CASE 
            WHEN metadata_boost AND array_length(search_locations, 1) > 0 AND 
              (c.subreddit ILIKE ANY(array_append(search_locations, '%'||search_locations[1]||'%')))
              THEN location_boost
            ELSE 1.0
          END as match_score,
        'location_boosted' as match_type,
        (1.0 - (c.content_embedding <=> embedding_vector)) * 
        CASE 
          WHEN metadata_boost AND array_length(search_locations, 1) > 0 AND 
            (c.subreddit ILIKE ANY(array_append(search_locations, '%'||search_locations[1]||'%')))
            THEN location_boost
          ELSE 1.0
        END AS score
      FROM public.content_representations c
      WHERE 
        c.content_embedding IS NOT NULL
        AND metadata_boost = TRUE
        AND array_length(search_locations, 1) > 0
        AND (c.subreddit ILIKE ANY(array_append(search_locations, '%'||search_locations[1]||'%')))
        AND (1.0 - (c.content_embedding <=> embedding_vector)) > match_threshold * 0.8
        AND (subreddits IS NULL OR c.subreddit = ANY(subreddits))
      ORDER BY score DESC
      LIMIT 20
    )
    
    -- STRATEGY 5: Fallback to Plain Text Search (if enabled and not enough results)
    UNION
    
    (
      SELECT 
        c.content_id as id,
        c.title,
        c.content,
        substring(c.content, 1, 300) as content_snippet,
        c.url,
        c.subreddit,
        c.author,
        c.content_type,
        to_timestamp(c.created_utc) as created_at,
        ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query)) * 0.8 as match_score,
        'text_search' as match_type,
        ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query)) * 0.8 AS score
      FROM public.content_representations c
      WHERE 
        use_fallback = TRUE
        AND to_tsvector('english', c.content) @@ plainto_tsquery('english', query)
        AND (subreddits IS NULL OR c.subreddit = ANY(subreddits))
      ORDER BY score DESC
      LIMIT 10
    )
  ),
  
  -- Deduplicate and combine results
  deduplicated_results AS (
    SELECT DISTINCT ON (id) 
      id,
      title,
      content,
      content_snippet,
      url,
      subreddit,
      author,
      content_type,
      created_at,
      match_score,
      match_type,
      score
    FROM result_candidates
    ORDER BY id, score DESC
  )
  
  -- Final result set
  SELECT 
    id,
    title,
    content,
    content_snippet,
    url,
    subreddit,
    author,
    content_type,
    created_at,
    match_score,
    match_type
  FROM deduplicated_results
  ORDER BY score DESC
  LIMIT max_results
  OFFSET result_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_content_multi_strategy(TEXT, public.vector(1536), JSONB, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_content_multi_strategy(TEXT, public.vector(1536), JSONB, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.search_content_multi_strategy(TEXT, public.vector(1536), JSONB, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated; 