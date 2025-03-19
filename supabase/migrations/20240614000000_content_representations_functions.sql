-- Migration for content representations functions
-- This adds functions for storing and retrieving different embedding types

-- Function to store a representation for a content item
CREATE OR REPLACE FUNCTION public.store_content_representation(
  p_content_id TEXT,
  p_content_type TEXT,
  p_representation_type TEXT,
  p_embedding_vector VECTOR(1536),
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  representation_id UUID;
BEGIN
  -- Check if representation already exists
  SELECT id INTO representation_id
  FROM public.content_representations
  WHERE parent_id = p_content_id
    AND content_type = p_content_type
    AND representation_type = p_representation_type;
    
  -- If it exists, update it
  IF representation_id IS NOT NULL THEN
    UPDATE public.content_representations
    SET 
      embedding = p_embedding_vector,
      metadata = COALESCE(p_metadata, '{}'::jsonb)
    WHERE id = representation_id;
    
    RETURN representation_id;
  END IF;
  
  -- Otherwise, insert a new representation
  INSERT INTO public.content_representations (
    parent_id,
    content_type,
    representation_type,
    embedding,
    metadata
  ) VALUES (
    p_content_id,
    p_content_type,
    p_representation_type,
    p_embedding_vector,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO representation_id;
  
  RETURN representation_id;
END;
$$;

-- Function to get a specific representation for a content item
CREATE OR REPLACE FUNCTION public.get_content_representation(
  p_content_id TEXT,
  p_content_type TEXT,
  p_representation_type TEXT DEFAULT 'full'
)
RETURNS TABLE (
  id UUID,
  parent_id TEXT,
  content_type TEXT,
  representation_type TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.parent_id,
    cr.content_type,
    cr.representation_type,
    cr.embedding,
    cr.metadata,
    cr.created_at
  FROM public.content_representations cr
  WHERE cr.parent_id = p_content_id
    AND cr.content_type = p_content_type
    AND cr.representation_type = p_representation_type;
END;
$$;

-- Function to get all representations for a content item
CREATE OR REPLACE FUNCTION public.get_all_content_representations(
  p_content_id TEXT,
  p_content_type TEXT
)
RETURNS TABLE (
  id UUID,
  parent_id TEXT,
  content_type TEXT,
  representation_type TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.parent_id,
    cr.content_type,
    cr.representation_type,
    cr.embedding,
    cr.metadata,
    cr.created_at
  FROM public.content_representations cr
  WHERE cr.parent_id = p_content_id
    AND cr.content_type = p_content_type
  ORDER BY cr.representation_type;
END;
$$;

-- Function to calculate similarity between content items based on specific representation types
CREATE OR REPLACE FUNCTION public.calculate_content_similarity(
  p_content_id_1 TEXT,
  p_content_type_1 TEXT,
  p_content_id_2 TEXT,
  p_content_type_2 TEXT,
  p_representation_type TEXT DEFAULT 'full'
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  similarity FLOAT;
  embedding_1 VECTOR(1536);
  embedding_2 VECTOR(1536);
BEGIN
  -- Get embeddings for both content items
  SELECT embedding INTO embedding_1
  FROM public.content_representations
  WHERE parent_id = p_content_id_1
    AND content_type = p_content_type_1
    AND representation_type = p_representation_type;
    
  SELECT embedding INTO embedding_2
  FROM public.content_representations
  WHERE parent_id = p_content_id_2
    AND content_type = p_content_type_2
    AND representation_type = p_representation_type;
    
  -- If either embedding is missing, return 0
  IF embedding_1 IS NULL OR embedding_2 IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate cosine similarity
  similarity := 1 - (embedding_1 <=> embedding_2);
  
  RETURN similarity;
END;
$$;

-- Migration: Content Representations Refresh Functions
-- Description: Functions to refresh content representations and manage reprocessing

-- Function to refresh content representations
-- This allows for mass reprocessing of content when needed
CREATE OR REPLACE FUNCTION public.refresh_content_representations(
  refresh_type TEXT DEFAULT 'all', -- 'all', 'posts', 'comments'
  batch_size INTEGER DEFAULT 100,
  priority SMALLINT DEFAULT 5,
  filter_subreddit TEXT DEFAULT NULL,
  min_age_hours INTEGER DEFAULT NULL,
  max_age_hours INTEGER DEFAULT NULL,
  representation_types TEXT[] DEFAULT ARRAY['context_enhanced', 'full']
) RETURNS JSON AS $$
DECLARE
  queued_count INTEGER := 0;
  posts_count INTEGER := 0;
  comments_count INTEGER := 0;
  start_time TIMESTAMPTZ := NOW();
  post_time_filter TIMESTAMPTZ := NULL;
  comment_time_filter TIMESTAMPTZ := NULL;
  result JSON;
BEGIN
  -- Calculate time filters if provided
  IF min_age_hours IS NOT NULL THEN
    post_time_filter := NOW() - (min_age_hours || ' hours')::INTERVAL;
    comment_time_filter := NOW() - (min_age_hours || ' hours')::INTERVAL;
  END IF;
  
  -- Process posts if requested
  IF refresh_type IN ('all', 'posts') THEN
    -- Identify posts that need to be reprocessed
    WITH posts_to_process AS (
      SELECT p.id
      FROM public.reddit_posts p
      WHERE 
        -- Check if the post should be processed based on filters
        (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
        AND (
          -- Either no representation types specified, or post is missing at least one of the specified types
          representation_types IS NULL 
          OR NOT EXISTS (
            SELECT 1 
            FROM content_representations cr
            WHERE cr.parent_id = p.id
              AND cr.content_type = 'post'
              AND cr.representation_type = ANY(representation_types)
          )
        )
        -- Apply time filter if specified (either created_at or last_updated)
        AND (
          min_age_hours IS NULL 
          OR p.created_at < post_time_filter
          OR p.last_updated < post_time_filter
        )
        AND (
          max_age_hours IS NULL
          OR p.created_at > (NOW() - (max_age_hours || ' hours')::INTERVAL)
        )
      LIMIT batch_size
    ),
    -- Insert into queue and get the count
    queued_posts AS (
      INSERT INTO util.embedding_queue(
        record_id,
        schema_name,
        table_name,
        content_function,
        embedding_column,
        status,
        priority,
        subreddit
      )
      SELECT 
        p.id,
        'public',
        'reddit_posts',
        'get_post_content',
        'embedding',
        'pending',
        priority,
        (SELECT subreddit FROM public.reddit_posts WHERE id = p.id)
      FROM posts_to_process p
      RETURNING record_id
    )
    SELECT COUNT(*) INTO posts_count FROM queued_posts;
    
    queued_count := queued_count + posts_count;
  END IF;
  
  -- Process comments if requested
  IF refresh_type IN ('all', 'comments') THEN
    -- Identify comments that need to be reprocessed
    WITH comments_to_process AS (
      SELECT c.id
      FROM public.reddit_comments c
      WHERE 
        -- Check if subreddit filter applies (need to join to posts)
        (filter_subreddit IS NULL OR 
          EXISTS (
            SELECT 1 FROM public.reddit_posts p 
            WHERE p.id = c.post_id AND p.subreddit = filter_subreddit
          )
        )
        AND (
          -- Either no representation types specified, or comment is missing at least one of the specified types
          representation_types IS NULL 
          OR NOT EXISTS (
            SELECT 1 
            FROM content_representations cr
            WHERE cr.parent_id = c.id
              AND cr.content_type = 'comment'
              AND cr.representation_type = ANY(representation_types)
          )
        )
        -- Apply time filter if specified
        AND (
          min_age_hours IS NULL 
          OR c.created_at < comment_time_filter
        )
        AND (
          max_age_hours IS NULL
          OR c.created_at > (NOW() - (max_age_hours || ' hours')::INTERVAL)
        )
      LIMIT batch_size
    ),
    -- Insert into queue and get the count
    queued_comments AS (
      INSERT INTO util.embedding_queue(
        record_id,
        schema_name,
        table_name,
        content_function,
        embedding_column,
        status,
        priority,
        subreddit
      )
      SELECT 
        c.id,
        'public',
        'reddit_comments',
        'get_comment_content',
        'embedding',
        'pending',
        priority - 1, -- Lower priority than posts
        (
          SELECT p.subreddit 
          FROM public.reddit_posts p 
          WHERE p.id = (
            SELECT post_id FROM public.reddit_comments WHERE id = c.id
          )
        )
      FROM comments_to_process c
      RETURNING record_id
    )
    SELECT COUNT(*) INTO comments_count FROM queued_comments;
    
    queued_count := queued_count + comments_count;
  END IF;
  
  -- Prepare result
  result := json_build_object(
    'success', TRUE,
    'queued_count', queued_count,
    'posts_count', posts_count,
    'comments_count', comments_count,
    'refresh_type', refresh_type,
    'batch_size', batch_size,
    'execution_time_ms', EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
    'message', 'Content reprocessing queued successfully'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get content representation status
-- This helps monitor the progress of representations
CREATE OR REPLACE FUNCTION public.get_content_representation_status(
  filter_subreddit TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH post_stats AS (
    SELECT
      COUNT(*) AS total_posts,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) AS posts_with_embedding,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM content_representations cr
        WHERE cr.parent_id = p.id AND cr.content_type = 'post' AND cr.representation_type = 'full'
      ) THEN 1 ELSE 0 END) AS posts_with_full_rep,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM content_representations cr
        WHERE cr.parent_id = p.id AND cr.content_type = 'post' AND cr.representation_type = 'context_enhanced'
      ) THEN 1 ELSE 0 END) AS posts_with_context_rep,
      SUM(CASE WHEN extracted_topics IS NOT NULL AND array_length(extracted_topics, 1) > 0 THEN 1 ELSE 0 END) AS posts_with_topics,
      COUNT(DISTINCT subreddit) AS subreddit_count
    FROM
      public.reddit_posts p
    WHERE
      (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
  ),
  comment_stats AS (
    SELECT
      COUNT(*) AS total_comments,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) AS comments_with_embedding,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM content_representations cr
        WHERE cr.parent_id = c.id AND cr.content_type = 'comment' AND cr.representation_type = 'full'
      ) THEN 1 ELSE 0 END) AS comments_with_full_rep,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM content_representations cr
        WHERE cr.parent_id = c.id AND cr.content_type = 'comment' AND cr.representation_type = 'context_enhanced'
      ) THEN 1 ELSE 0 END) AS comments_with_context_rep,
      SUM(CASE WHEN extracted_topics IS NOT NULL AND array_length(extracted_topics, 1) > 0 THEN 1 ELSE 0 END) AS comments_with_topics
    FROM
      public.reddit_comments c
    WHERE
      filter_subreddit IS NULL OR EXISTS (
        SELECT 1 FROM public.reddit_posts p 
        WHERE p.id = c.post_id AND p.subreddit = filter_subreddit
      )
  ),
  queue_stats AS (
    SELECT
      COUNT(CASE WHEN status = 'pending' AND table_name = 'reddit_posts' THEN 1 END) AS pending_posts,
      COUNT(CASE WHEN status = 'processing' AND table_name = 'reddit_posts' THEN 1 END) AS processing_posts,
      COUNT(CASE WHEN status = 'failed' AND table_name = 'reddit_posts' THEN 1 END) AS failed_posts,
      COUNT(CASE WHEN status = 'pending' AND table_name = 'reddit_comments' THEN 1 END) AS pending_comments,
      COUNT(CASE WHEN status = 'processing' AND table_name = 'reddit_comments' THEN 1 END) AS processing_comments,
      COUNT(CASE WHEN status = 'failed' AND table_name = 'reddit_comments' THEN 1 END) AS failed_comments
    FROM
      util.embedding_queue
    WHERE
      filter_subreddit IS NULL OR subreddit = filter_subreddit
  ),
  chunks_stats AS (
    SELECT
      COUNT(*) AS total_chunks,
      COUNT(CASE WHEN content_type = 'post' THEN 1 END) AS post_chunks,
      COUNT(CASE WHEN content_type = 'comment' THEN 1 END) AS comment_chunks,
      COUNT(DISTINCT parent_id) AS unique_parents
    FROM
      public.content_chunks
    WHERE
      filter_subreddit IS NULL OR EXISTS (
        SELECT 1 FROM public.reddit_posts p
        WHERE (p.id = parent_id OR 
              EXISTS (SELECT 1 FROM public.reddit_comments c WHERE c.id = parent_id AND c.post_id = p.id))
        AND p.subreddit = filter_subreddit
      )
  )
  SELECT json_build_object(
    'post_stats', row_to_json(ps),
    'comment_stats', row_to_json(cs),
    'queue_stats', row_to_json(qs),
    'chunk_stats', row_to_json(chs),
    'generated_at', NOW(),
    'filter_subreddit', filter_subreddit
  ) INTO result
  FROM post_stats ps, comment_stats cs, queue_stats qs, chunks_stats chs;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Add grants for these functions
GRANT EXECUTE ON FUNCTION public.refresh_content_representations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_content_representation_status TO anon, authenticated, service_role;

-- Add function comments
COMMENT ON FUNCTION public.refresh_content_representations IS 'Queues content items for reprocessing to generate or update their vector representations.';
COMMENT ON FUNCTION public.get_content_representation_status IS 'Returns statistics about the current state of content representations.'; 