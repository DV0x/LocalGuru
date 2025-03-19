-- Create multi-strategy search function that combines different search approaches
-- based on query analysis and search configuration

-- Type for search configuration
CREATE TYPE search_opt.search_config AS (
  similarity_threshold FLOAT,
  max_results INTEGER,
  include_comments BOOLEAN,
  content_boost FLOAT,
  title_boost FLOAT,
  context_boost FLOAT,
  locations TEXT[],
  topics TEXT[]
);

CREATE OR REPLACE FUNCTION search_opt.multi_strategy_search(
  query_text TEXT,
  query_embedding VECTOR(1536),
  search_config JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  content_id TEXT,
  content_type TEXT,
  post_id TEXT,
  title TEXT,
  url TEXT,
  subreddit TEXT,
  author TEXT,
  score FLOAT,
  match_type TEXT[],
  match_score FLOAT,
  match_reason TEXT,
  content TEXT,
  embedding_type TEXT,
  created_utc BIGINT,
  permalink TEXT
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_similarity_threshold FLOAT := 0.65;
  v_max_results INTEGER := 20;
  v_include_comments BOOLEAN := TRUE;
  v_content_boost FLOAT := 1.0;
  v_title_boost FLOAT := 1.5;
  v_context_boost FLOAT := 1.2; 
  v_locations TEXT[] := '{}';
  v_topics TEXT[] := '{}';
  v_subreddit_boost FLOAT := 0.2;
  v_topic_boost FLOAT := 0.15;
  v_location_boost FLOAT := 0.3;
  v_recency_boost FLOAT := 0.1;
  v_has_locations BOOLEAN := FALSE;
  v_has_topics BOOLEAN := FALSE;
BEGIN
  -- Extract config parameters with defaults
  IF search_config IS NOT NULL THEN
    v_similarity_threshold := COALESCE((search_config->>'similarity_threshold')::FLOAT, v_similarity_threshold);
    v_max_results := COALESCE((search_config->>'max_results')::INTEGER, v_max_results);
    v_include_comments := COALESCE((search_config->>'include_comments')::BOOLEAN, v_include_comments);
    v_content_boost := COALESCE((search_config->>'content_boost')::FLOAT, v_content_boost);
    v_title_boost := COALESCE((search_config->>'title_boost')::FLOAT, v_title_boost);
    v_context_boost := COALESCE((search_config->>'context_boost')::FLOAT, v_context_boost);
    
    -- Extract locations and topics arrays if they exist
    IF search_config ? 'locations' AND jsonb_array_length(search_config->'locations') > 0 THEN
      SELECT array_agg(jsonb_array_elements_text(search_config->'locations')) INTO v_locations;
      v_has_locations := TRUE;
    END IF;
    
    IF search_config ? 'topics' AND jsonb_array_length(search_config->'topics') > 0 THEN
      SELECT array_agg(jsonb_array_elements_text(search_config->'topics')) INTO v_topics;
      v_has_topics := TRUE;
    END IF;
  END IF;

  RETURN QUERY
  WITH combined_search AS (
    -- Title representation search (higher weight for precise title matches)
    (SELECT 
      cr.content_id,
      cr.content_type,
      cr.post_id,
      CASE 
        WHEN cr.content_type = 'post' THEN p.title
        ELSE NULL
      END AS title,
      CASE 
        WHEN cr.content_type = 'post' THEN p.url
        ELSE NULL
      END AS url,
      CASE 
        WHEN cr.content_type = 'post' THEN p.subreddit
        WHEN cr.content_type = 'comment' THEN c.subreddit
        ELSE NULL
      END AS subreddit,
      CASE 
        WHEN cr.content_type = 'post' THEN p.author
        WHEN cr.content_type = 'comment' THEN c.author
        ELSE NULL
      END AS author,
      1 - (cr.embedding <=> query_embedding) AS base_score,
      ARRAY['title']::TEXT[] AS match_type,
      (1 - (cr.embedding <=> query_embedding)) * v_title_boost AS match_score,
      'Title representation match' AS match_reason,
      CASE 
        WHEN cr.content_type = 'post' THEN p.selftext
        WHEN cr.content_type = 'comment' THEN c.body
        ELSE NULL
      END AS content,
      cr.embedding_type,
      CASE 
        WHEN cr.content_type = 'post' THEN p.created_utc
        WHEN cr.content_type = 'comment' THEN c.created_utc
        ELSE NULL
      END AS created_utc,
      CASE 
        WHEN cr.content_type = 'post' THEN p.permalink
        WHEN cr.content_type = 'comment' THEN c.permalink
        ELSE NULL
      END AS permalink
    FROM public.content_representations cr
    LEFT JOIN public.reddit_posts p ON cr.content_id = p.id AND cr.content_type = 'post'
    LEFT JOIN public.reddit_comments c ON cr.content_id = c.id AND cr.content_type = 'comment'
    WHERE 
      cr.embedding_type = 'title' AND
      (1 - (cr.embedding <=> query_embedding)) > v_similarity_threshold AND
      (v_include_comments OR cr.content_type = 'post')
    ORDER BY match_score DESC
    LIMIT v_max_results)
    
    UNION ALL
    
    -- Full content representation search (standard weight)
    (SELECT 
      cr.content_id,
      cr.content_type,
      cr.post_id,
      CASE 
        WHEN cr.content_type = 'post' THEN p.title
        ELSE NULL
      END AS title,
      CASE 
        WHEN cr.content_type = 'post' THEN p.url
        ELSE NULL
      END AS url,
      CASE 
        WHEN cr.content_type = 'post' THEN p.subreddit
        WHEN cr.content_type = 'comment' THEN c.subreddit
        ELSE NULL
      END AS subreddit,
      CASE 
        WHEN cr.content_type = 'post' THEN p.author
        WHEN cr.content_type = 'comment' THEN c.author
        ELSE NULL
      END AS author,
      1 - (cr.embedding <=> query_embedding) AS base_score,
      ARRAY['full_content']::TEXT[] AS match_type,
      (1 - (cr.embedding <=> query_embedding)) * v_content_boost AS match_score,
      'Full content representation match' AS match_reason,
      CASE 
        WHEN cr.content_type = 'post' THEN p.selftext
        WHEN cr.content_type = 'comment' THEN c.body
        ELSE NULL
      END AS content,
      cr.embedding_type,
      CASE 
        WHEN cr.content_type = 'post' THEN p.created_utc
        WHEN cr.content_type = 'comment' THEN c.created_utc
        ELSE NULL
      END AS created_utc,
      CASE 
        WHEN cr.content_type = 'post' THEN p.permalink
        WHEN cr.content_type = 'comment' THEN c.permalink
        ELSE NULL
      END AS permalink
    FROM public.content_representations cr
    LEFT JOIN public.reddit_posts p ON cr.content_id = p.id AND cr.content_type = 'post'
    LEFT JOIN public.reddit_comments c ON cr.content_id = c.id AND cr.content_type = 'comment'
    WHERE 
      cr.embedding_type = 'full' AND
      (1 - (cr.embedding <=> query_embedding)) > v_similarity_threshold AND
      (v_include_comments OR cr.content_type = 'post')
    ORDER BY match_score DESC
    LIMIT v_max_results)
    
    UNION ALL
    
    -- Context-enhanced representation search (moderate boost for enhanced context)
    (SELECT 
      cr.content_id,
      cr.content_type,
      cr.post_id,
      CASE 
        WHEN cr.content_type = 'post' THEN p.title
        ELSE NULL
      END AS title,
      CASE 
        WHEN cr.content_type = 'post' THEN p.url
        ELSE NULL
      END AS url,
      CASE 
        WHEN cr.content_type = 'post' THEN p.subreddit
        WHEN cr.content_type = 'comment' THEN c.subreddit
        ELSE NULL
      END AS subreddit,
      CASE 
        WHEN cr.content_type = 'post' THEN p.author
        WHEN cr.content_type = 'comment' THEN c.author
        ELSE NULL
      END AS author,
      1 - (cr.embedding <=> query_embedding) AS base_score,
      ARRAY['context_enhanced']::TEXT[] AS match_type,
      (1 - (cr.embedding <=> query_embedding)) * v_context_boost AS match_score,
      'Context-enhanced representation match' AS match_reason,
      CASE 
        WHEN cr.content_type = 'post' THEN p.selftext
        WHEN cr.content_type = 'comment' THEN c.body
        ELSE NULL
      END AS content,
      cr.embedding_type,
      CASE 
        WHEN cr.content_type = 'post' THEN p.created_utc
        WHEN cr.content_type = 'comment' THEN c.created_utc
        ELSE NULL
      END AS created_utc,
      CASE 
        WHEN cr.content_type = 'post' THEN p.permalink
        WHEN cr.content_type = 'comment' THEN c.permalink
        ELSE NULL
      END AS permalink
    FROM public.content_representations cr
    LEFT JOIN public.reddit_posts p ON cr.content_id = p.id AND cr.content_type = 'post'
    LEFT JOIN public.reddit_comments c ON cr.content_id = c.id AND cr.content_type = 'comment'
    WHERE 
      cr.embedding_type = 'context_enhanced' AND
      (1 - (cr.embedding <=> query_embedding)) > v_similarity_threshold AND
      (v_include_comments OR cr.content_type = 'post')
    ORDER BY match_score DESC
    LIMIT v_max_results)
  ),
  
  -- Apply metadata-based boosting
  boosted_results AS (
    SELECT 
      content_id,
      content_type,
      post_id,
      title,
      url,
      subreddit,
      author,
      base_score,
      match_type,
      match_score +
        -- Location-based boost
        CASE WHEN v_has_locations AND subreddit IS NOT NULL AND 
                 subreddit = ANY(v_locations) 
             THEN v_location_boost
             ELSE 0 END +
        -- Topic-based boost (simplified - in a real implementation, 
        -- you might want to use a more sophisticated approach)
        CASE WHEN v_has_topics AND title IS NOT NULL AND 
                 EXISTS (SELECT 1 FROM unnest(v_topics) t 
                         WHERE title ILIKE '%' || t || '%')
             THEN v_topic_boost
             ELSE 0 END +
        -- Recency boost (simplified - newer content gets a small boost)
        CASE WHEN created_utc IS NOT NULL 
             THEN v_recency_boost * (created_utc::float / (extract(epoch from now())::float))
             ELSE 0 END
      AS final_score,
      match_reason,
      content,
      embedding_type,
      created_utc,
      permalink
    FROM combined_search
  ),
  
  -- Deduplicate and rank results
  ranked_results AS (
    SELECT 
      content_id,
      content_type,
      post_id,
      title,
      url,
      subreddit,
      author,
      base_score,
      ARRAY_AGG(DISTINCT match_type[1]) AS match_types,
      MAX(final_score) AS max_score,
      STRING_AGG(DISTINCT match_reason, ', ') AS match_reasons,
      content,
      ARRAY_AGG(DISTINCT embedding_type) AS embedding_types,
      created_utc,
      permalink
    FROM boosted_results
    GROUP BY 
      content_id, content_type, post_id, title, url, 
      subreddit, author, base_score, content, created_utc, permalink
    ORDER BY max_score DESC
    LIMIT v_max_results
  )
  
  SELECT
    content_id,
    content_type,
    post_id,
    title,
    url,
    subreddit,
    author,
    base_score AS score,
    match_types AS match_type,
    max_score AS match_score,
    match_reasons AS match_reason,
    content,
    embedding_types[1] AS embedding_type,
    created_utc,
    permalink
  FROM ranked_results;
END;
$$;

-- Grant access to the new function
GRANT EXECUTE ON FUNCTION search_opt.multi_strategy_search TO service_role, anon, authenticated; 