-- Create a simplified version of multi_strategy_search that's more efficient
CREATE OR REPLACE FUNCTION simple_strategy_search(
  p_query TEXT,
  p_query_embedding VECTOR(1536),
  p_query_intent TEXT DEFAULT 'general',
  p_query_topics TEXT[] DEFAULT '{}',
  p_query_locations TEXT[] DEFAULT '{}',
  p_max_results INTEGER DEFAULT 20,
  p_match_threshold FLOAT DEFAULT 0.5
) 
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  content_snippet TEXT,
  url TEXT,
  subreddit TEXT,
  author TEXT,
  content_type TEXT,
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
BEGIN
  -- Set boost factors based on query intent
  CASE p_query_intent
    WHEN 'recommendation' THEN
      v_content_boost := 1.0;
      v_title_boost := 1.8;
      v_context_boost := 1.2;
    WHEN 'information' THEN
      v_content_boost := 1.5;
      v_title_boost := 1.2;
      v_context_boost := 1.3;
    WHEN 'discovery' THEN
      v_content_boost := 1.4;
      v_title_boost := 1.3;
      v_context_boost := 1.5;
    ELSE -- general and other intents
      v_content_boost := 1.0;
      v_title_boost := 1.5;
      v_context_boost := 1.2;
  END CASE;

  -- Return just the basic, most efficient search for larger datasets
  RETURN QUERY
  WITH combined_search AS (
    -- Basic content representation search
    SELECT 
      cr.parent_id,
      cr.representation_type,
      cr.content_type,
      (1.0 - (cr.embedding <=> p_query_embedding)) AS base_similarity,
      CASE 
        WHEN cr.representation_type = 'title' THEN (1.0 - (cr.embedding <=> p_query_embedding)) * v_title_boost
        WHEN cr.representation_type = 'basic' THEN (1.0 - (cr.embedding <=> p_query_embedding)) * v_content_boost
        WHEN cr.representation_type = 'context_enhanced' THEN (1.0 - (cr.embedding <=> p_query_embedding)) * v_context_boost
        ELSE (1.0 - (cr.embedding <=> p_query_embedding))
      END AS boosted_similarity,
      cr.metadata,
      cr.created_at
    FROM 
      content_representations cr
    WHERE 
      (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY 
      boosted_similarity DESC
    LIMIT 100
  ),
  
  -- Deduplicate results (take highest score for each parent_id)
  deduplicated AS (
    SELECT DISTINCT ON (parent_id)
      parent_id,
      representation_type,
      content_type,
      base_similarity,
      boosted_similarity,
      metadata,
      created_at
    FROM 
      combined_search
    ORDER BY 
      parent_id, boosted_similarity DESC
  )
  
  -- Join with content table to get full content details
  SELECT 
    d.parent_id::TEXT AS id,
    c.title,
    c.content,
    c.content AS content_snippet,
    c.url,
    c.subreddit,
    c.author,
    d.content_type,
    d.created_at,
    d.base_similarity AS similarity,
    d.representation_type AS match_type,
    d.metadata
  FROM 
    deduplicated d
  JOIN 
    content c ON d.parent_id = c.id
  ORDER BY 
    d.boosted_similarity DESC
  LIMIT 
    p_max_results;
END;
$$; 