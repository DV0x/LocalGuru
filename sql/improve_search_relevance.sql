-- SQL script to improve the multi_strategy_search function
-- This script adds additional filtering for dietary terms and improves relevance scoring

-- First, let's create a function to check if a query contains dietary terms
CREATE OR REPLACE FUNCTION search_opt.has_dietary_term(p_query text)
RETURNS boolean AS $$
DECLARE
  dietary_terms text[] := ARRAY['vegan', 'vegetarian', 'gluten-free', 'gluten free', 'dairy-free', 'dairy free', 'keto', 'paleo', 'pescatarian'];
  term text;
BEGIN
  FOREACH term IN ARRAY dietary_terms LOOP
    IF p_query ILIKE '%' || term || '%' THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Now, let's modify the multi_strategy_search function to improve relevance
CREATE OR REPLACE FUNCTION public.multi_strategy_search(
  p_query text,
  p_embedding vector(1536),
  p_intent text DEFAULT 'general',
  p_topics text[] DEFAULT '{}',
  p_locations text[] DEFAULT '{}',
  p_max_results integer DEFAULT 10,
  p_match_threshold float DEFAULT 0.6
)
RETURNS TABLE (
  id text,
  title text,
  content_snippet text,
  subreddit text,
  url text,
  content_type text,
  match_score float,
  match_type text
) AS $$
DECLARE
  has_dietary boolean;
  dietary_terms text[] := ARRAY['vegan', 'vegetarian', 'gluten-free', 'gluten free', 'dairy-free', 'dairy free', 'keto', 'paleo', 'pescatarian'];
  dietary_term text;
  dietary_filter_applied boolean := false;
BEGIN
  -- Check if query contains dietary terms
  has_dietary := search_opt.has_dietary_term(p_query);
  
  -- Get all matches using the original multi_strategy_search logic
  RETURN QUERY
  WITH 
  -- Basic content representation search
  basic_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      1.0 * (1.0 - (c.content_embedding <=> p_embedding)) AS similarity,
      'basic' AS match_type
    FROM content c
    WHERE 1.0 - (c.content_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Title representation search
  title_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      1.0 * (1.0 - (c.title_embedding <=> p_embedding)) AS similarity,
      'title' AS match_type
    FROM content c
    WHERE 1.0 - (c.title_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Context-enhanced representation search
  context_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) AS similarity,
      'context_enhanced' AS match_type
    FROM content c
    WHERE 1.0 - (c.context_enhanced_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Location-boosted search
  location_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      CASE
        WHEN p_intent = 'recommendation' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.5
        WHEN p_intent = 'information' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.3
        ELSE 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.2
      END AS similarity,
      'location_boosted' AS match_type
    FROM content c
    JOIN content_locations cl ON c.id = cl.content_id
    WHERE 
      cl.location = ANY(p_locations)
      AND 1.0 - (c.content_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 30
  ),
  
  -- Topic-boosted search
  topic_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      CASE
        WHEN p_intent = 'recommendation' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.3
        WHEN p_intent = 'information' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.4
        ELSE 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.2
      END AS similarity,
      'topic_boosted' AS match_type
    FROM content c
    JOIN content_topics ct ON c.id = ct.content_id
    WHERE 
      ct.topic = ANY(p_topics)
      AND 1.0 - (c.content_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 30
  ),
  
  -- Combine all matches
  all_matches AS (
    SELECT * FROM basic_matches
    UNION ALL
    SELECT * FROM title_matches
    UNION ALL
    SELECT * FROM context_matches
    UNION ALL
    SELECT * FROM location_matches
    UNION ALL
    SELECT * FROM topic_matches
  ),
  
  -- Get the highest scoring match for each content
  best_matches AS (
    SELECT DISTINCT ON (id)
      id,
      title,
      content_snippet,
      subreddit,
      url,
      content_type,
      similarity AS match_score,
      match_type
    FROM all_matches
    ORDER BY id, similarity DESC
  )
  
  -- Apply dietary term filtering if query contains dietary terms
  SELECT 
    bm.id,
    bm.title,
    bm.content_snippet,
    bm.subreddit,
    bm.url,
    bm.content_type,
    bm.match_score,
    bm.match_type
  FROM best_matches bm
  WHERE 
    -- If query has dietary terms, prioritize content that mentions those terms
    CASE 
      WHEN has_dietary THEN
        -- Check if any dietary term from the topics is in the content
        EXISTS (
          SELECT 1 
          FROM unnest(p_topics) topic
          WHERE topic = ANY(dietary_terms)
            AND (
              bm.title ILIKE '%' || topic || '%' OR
              bm.content_snippet ILIKE '%' || topic || '%'
            )
        )
        -- If no matches with dietary terms, still return some results
        OR bm.match_score > p_match_threshold * 1.5
      ELSE 
        -- No dietary filtering needed
        TRUE
    END
  ORDER BY 
    -- Prioritize matches that contain dietary terms if query has them
    CASE 
      WHEN has_dietary THEN
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM unnest(p_topics) topic
            WHERE topic = ANY(dietary_terms)
              AND (
                bm.title ILIKE '%' || topic || '%' OR
                bm.content_snippet ILIKE '%' || topic || '%'
              )
          ) THEN 1
          ELSE 2
        END
      ELSE 0
    END,
    bm.match_score DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql; 