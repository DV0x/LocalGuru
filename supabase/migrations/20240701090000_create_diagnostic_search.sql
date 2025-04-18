-- Diagnostic function to search with minimal filtering
CREATE OR REPLACE FUNCTION public.diagnostic_search(
  p_location_hint text DEFAULT NULL,
  p_topic_hint text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id text,
  content_type text,
  title text,
  content_preview text,
  match_type text,
  metadata jsonb,
  locations text[],
  topics text[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Find any content with location data
  SELECT 
    cr.parent_id AS id,
    cr.content_type,
    CASE 
      WHEN cr.content_type = 'post' THEN 
        (SELECT title FROM reddit_posts WHERE id = cr.parent_id)
      ELSE
        (SELECT title FROM reddit_posts WHERE id = (SELECT post_id FROM reddit_comments WHERE id = cr.parent_id))
    END AS title,
    CASE 
      WHEN cr.content_type = 'post' THEN 
        (SELECT SUBSTRING(content, 1, 100) FROM reddit_posts WHERE id = cr.parent_id)
      ELSE
        (SELECT SUBSTRING(content, 1, 100) FROM reddit_comments WHERE id = cr.parent_id)
    END AS content_preview,
    cr.representation_type AS match_type,
    cr.metadata,
    CASE 
      WHEN cr.metadata ? 'locations' THEN 
        array(SELECT jsonb_array_elements_text(cr.metadata->'locations'))
      ELSE 
        ARRAY[]::text[]
    END AS locations,
    CASE 
      WHEN cr.metadata ? 'topics' THEN 
        array(SELECT jsonb_array_elements_text(cr.metadata->'topics'))
      ELSE 
        ARRAY[]::text[]
    END AS topics
  FROM 
    content_representations cr
  WHERE 
    cr.metadata IS NOT NULL
    AND (
      -- Filter for locations if provided
      p_location_hint IS NULL 
      OR (
        cr.metadata ? 'locations'
        AND (
          EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(cr.metadata->'locations') AS loc
            WHERE loc ILIKE '%' || p_location_hint || '%'
          )
        )
      )
    )
    AND (
      -- Filter for topics if provided
      p_topic_hint IS NULL 
      OR (
        cr.metadata ? 'topics'
        AND (
          EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(cr.metadata->'topics') AS topic
            WHERE topic ILIKE '%' || p_topic_hint || '%'
          )
        )
      )
    )
  ORDER BY 
    CASE 
      WHEN p_location_hint IS NOT NULL AND cr.metadata ? 'locations' THEN 1
      ELSE 2
    END,
    CASE 
      WHEN p_topic_hint IS NOT NULL AND cr.metadata ? 'topics' THEN 1
      ELSE 2
    END
  LIMIT p_limit;
$$;

-- Also create a function to check content_representations schema
CREATE OR REPLACE FUNCTION public.check_metadata_structure()
RETURNS TABLE(
  parent_id text,
  content_type text,
  representation_type text,
  metadata_keys text[],
  sample_metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH metadata_samples AS (
    SELECT DISTINCT ON (jsonb_object_keys(metadata))
      parent_id,
      content_type,
      representation_type,
      jsonb_object_keys(metadata) as metadata_key,
      metadata
    FROM 
      content_representations
    WHERE 
      metadata IS NOT NULL
    ORDER BY 
      jsonb_object_keys(metadata),
      parent_id
  )
  
  SELECT 
    parent_id,
    content_type,
    representation_type,
    array_agg(metadata_key) as metadata_keys,
    metadata as sample_metadata
  FROM 
    metadata_samples
  GROUP BY 
    parent_id, content_type, representation_type, metadata
  LIMIT 10;
$$;

-- Function to check the content directly for specific phrases
CREATE OR REPLACE FUNCTION public.direct_content_search(
  p_phrase text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id text,
  content_type text,
  title text,
  content_preview text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Search posts first
  (SELECT 
    id,
    'post' as content_type,
    title,
    SUBSTRING(content, 1, 200) as content_preview
  FROM 
    reddit_posts
  WHERE 
    content ILIKE '%' || p_phrase || '%'
    OR title ILIKE '%' || p_phrase || '%'
  LIMIT p_limit/2)
  
  UNION ALL
  
  -- Then search comments
  (SELECT 
    c.id,
    'comment' as content_type,
    p.title,
    SUBSTRING(c.content, 1, 200) as content_preview
  FROM 
    reddit_comments c
  JOIN 
    reddit_posts p ON c.post_id = p.id
  WHERE 
    c.content ILIKE '%' || p_phrase || '%'
  LIMIT p_limit/2);
$$;

-- Add comments
COMMENT ON FUNCTION public.diagnostic_search IS 'Diagnostic function to find content with specific locations or topics in metadata';
COMMENT ON FUNCTION public.check_metadata_structure IS 'Shows the structure of metadata in content_representations table';
COMMENT ON FUNCTION public.direct_content_search IS 'Directly searches content for specific phrases without using embeddings';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.diagnostic_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnostic_search TO service_role;
GRANT EXECUTE ON FUNCTION public.check_metadata_structure TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_metadata_structure TO service_role;
GRANT EXECUTE ON FUNCTION public.direct_content_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.direct_content_search TO service_role; 