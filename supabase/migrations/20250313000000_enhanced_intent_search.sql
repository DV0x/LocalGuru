-- Enhanced intent-based search function with additional intents
-- Adds support for 'local_events', 'how_to', and 'discovery' intents
-- Also improves boosting for existing intents: 'comparison' and 'experience'

-- First, drop the existing function
DROP FUNCTION IF EXISTS public.multi_strategy_search;

-- Create the enhanced function with additional intents
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
  id uuid,
  title text,
  content_snippet text,
  subreddit text,
  url text,
  content_type text,
  similarity float,
  match_type text
) AS $$
BEGIN
  -- Apply dietary term boosting logic for all search strategies
  RETURN QUERY
  
  WITH
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
        -- Recommendation: Prioritize location heavily
        WHEN p_intent = 'recommendation' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.5
        -- Information: Moderate location boost
        WHEN p_intent = 'information' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.3
        -- Comparison: Low-moderate location boost
        WHEN p_intent = 'comparison' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.2
        -- Experience: High location boost (experiences are location-specific)
        WHEN p_intent = 'experience' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.4
        -- Local Events: Highest location boost (events are highly location-dependent)
        WHEN p_intent = 'local_events' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.8
        -- How To: Minimal location boost (instructions rarely location-specific)
        WHEN p_intent = 'how_to' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.1
        -- Discovery: Moderate location boost (discovery often has location context)
        WHEN p_intent = 'discovery' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.3
        -- Default for general and other intents
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
  
  -- Title-boosted search
  title_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      CASE
        -- Recommendation: Moderate title boost
        WHEN p_intent = 'recommendation' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.3
        -- Information: Moderate-high title boost
        WHEN p_intent = 'information' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.4
        -- Comparison: High title boost (titles often contain comparable items)
        WHEN p_intent = 'comparison' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.5
        -- Experience: Moderate title boost
        WHEN p_intent = 'experience' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.3
        -- Local Events: High title boost (event names in titles)
        WHEN p_intent = 'local_events' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.5
        -- How To: High title boost (often contains the specific task)
        WHEN p_intent = 'how_to' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.6
        -- Discovery: Moderate title boost
        WHEN p_intent = 'discovery' THEN 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.3
        -- Default for general and other intents
        ELSE 1.0 * (1.0 - (c.title_embedding <=> p_embedding)) * 1.2
      END AS similarity,
      'title' AS match_type
    FROM content c
    WHERE 1.0 - (c.title_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 50
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
        -- Recommendation: Moderate topic boost
        WHEN p_intent = 'recommendation' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.3
        -- Information: High topic boost (information queries are topic-centric)
        WHEN p_intent = 'information' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.4
        -- Comparison: Highest topic boost (comparisons are strongly topic-oriented)
        WHEN p_intent = 'comparison' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.6
        -- Experience: Moderate-high topic boost
        WHEN p_intent = 'experience' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.35
        -- Local Events: Moderate topic boost (event category is important)
        WHEN p_intent = 'local_events' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.4
        -- How To: Very high topic boost (instructional content is topic-specific)
        WHEN p_intent = 'how_to' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.7
        -- Discovery: High topic boost (discovery is topic-focused)
        WHEN p_intent = 'discovery' THEN 1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.5
        -- Default for general and other intents
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
  
  -- Context-enhanced search
  context_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      CASE
        -- Recommendation: Moderate context boost
        WHEN p_intent = 'recommendation' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.2
        -- Information: High context boost (detailed context is valuable for information)
        WHEN p_intent = 'information' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.5
        -- Comparison: Moderate-high context boost
        WHEN p_intent = 'comparison' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.4
        -- Experience: Highest context boost (experiences are contextually rich)
        WHEN p_intent = 'experience' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.6
        -- Local Events: Moderate context boost (event details)
        WHEN p_intent = 'local_events' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.3
        -- How To: Very high context boost (detailed instructions)
        WHEN p_intent = 'how_to' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.7
        -- Discovery: High context boost (rich context helps discovery)
        WHEN p_intent = 'discovery' THEN 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.5
        -- Default for general and other intents
        ELSE 1.0 * (1.0 - (c.context_enhanced_embedding <=> p_embedding)) * 1.2
      END AS similarity,
      'context_enhanced' AS match_type
    FROM content c
    WHERE 1.0 - (c.context_enhanced_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Dietary term matches - boosted further when the query contains dietary terms
  dietary_matches AS (
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      CASE
        -- For queries with dietary preferences, boost accordingly
        WHEN search_opt.has_dietary_term(p_query) THEN 
          1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.8
        ELSE
          1.0 * (1.0 - (c.content_embedding <=> p_embedding)) * 1.0
      END AS similarity,
      'dietary_term' AS match_type
    FROM content c
    WHERE 
      search_opt.has_dietary_content(c.content_snippet)
      AND search_opt.has_dietary_term(p_query)
      AND 1.0 - (c.content_embedding <=> p_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT 20
  ),
  
  -- Combine all search strategies into a single result set
  combined_results AS (
    -- Standard embedding similarity search
    SELECT
      c.id,
      c.title,
      c.content_snippet,
      c.subreddit,
      c.url,
      c.content_type,
      1.0 * (1.0 - (c.content_embedding <=> p_embedding)) AS similarity,
      'embedding' AS match_type
    FROM content c
    WHERE 1.0 - (c.content_embedding <=> p_embedding) > p_match_threshold
    
    UNION ALL
    
    -- Add results from location-boosted search if locations present
    SELECT * FROM location_matches WHERE array_length(p_locations, 1) > 0
    
    UNION ALL
    
    -- Add results from topic-boosted search if topics present
    SELECT * FROM topic_matches WHERE array_length(p_topics, 1) > 0
    
    UNION ALL
    
    -- Add title-boosted results
    SELECT * FROM title_matches
    
    UNION ALL
    
    -- Add context-enhanced results
    SELECT * FROM context_matches
    
    UNION ALL
    
    -- Add dietary term matches if relevant
    SELECT * FROM dietary_matches WHERE search_opt.has_dietary_term(p_query)
  ),
  
  -- Deduplicate and take top results
  ranked_results AS (
    SELECT
      id,
      title,
      content_snippet,
      subreddit,
      url,
      content_type,
      similarity,
      match_type,
      ROW_NUMBER() OVER (PARTITION BY id ORDER BY similarity DESC) AS rn
    FROM combined_results
  ),
  
  final_results AS (
    SELECT
      id,
      title,
      content_snippet,
      subreddit,
      url,
      content_type,
      similarity,
      match_type
    FROM ranked_results
    WHERE rn = 1
    ORDER BY similarity DESC
    LIMIT p_max_results
  )
  
  SELECT * FROM final_results;
END;
$$ LANGUAGE plpgsql;

-- Create or update function to detect dietary terms
CREATE OR REPLACE FUNCTION search_opt.has_dietary_term(p_text text)
RETURNS boolean AS $$
BEGIN
  RETURN p_text ~* '\y(vegan|vegetarian|gluten.?free|dairy.?free|pescatarian|keto|paleo|plant.?based)\y';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create or update function to detect dietary content
CREATE OR REPLACE FUNCTION search_opt.has_dietary_content(p_text text)
RETURNS boolean AS $$
BEGIN
  RETURN p_text ~* '\y(vegan|vegetarian|gluten.?free|dairy.?free|pescatarian|keto|paleo|plant.?based)\y';
END;
$$ LANGUAGE plpgsql IMMUTABLE; 