-- Fix to the parallel_search function to ensure parameter types are correct

-- Drop existing function to recreate it
DROP FUNCTION IF EXISTS public.parallel_search;

-- Create the function with explicit parameter types
CREATE OR REPLACE FUNCTION public.parallel_search(
  search_query TEXT,
  similarity_threshold_docs DOUBLE PRECISION DEFAULT 0.65,
  similarity_threshold_chunks DOUBLE PRECISION DEFAULT 0.7,
  docs_weight DOUBLE PRECISION DEFAULT 0.8,
  max_results INTEGER DEFAULT 15
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  title TEXT,
  similarity DOUBLE PRECISION,
  text_preview TEXT,
  is_chunk BOOLEAN,
  chunk_index INTEGER,
  parent_title TEXT,
  subreddit TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_embedding VECTOR(1536);
BEGIN
  -- Generate embedding for the search query
  SELECT openai.embed(search_query) INTO query_embedding;
  
  RETURN QUERY
  
  WITH 
  -- Search in document-level embeddings (posts)
  post_results AS (
    SELECT 
      id, 
      'post' AS content_type,
      title,
      (1 - (embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE 
        WHEN length(content) > 200 THEN substring(content, 1, 200) || '...'
        ELSE content
      END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      NULL::TEXT AS parent_title,
      subreddit
    FROM reddit_posts
    WHERE 1 - (embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Search in document-level embeddings (comments)
  comment_results AS (
    SELECT 
      c.id, 
      'comment' AS content_type,
      NULL AS title,
      (1 - (c.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      CASE 
        WHEN length(c.content) > 200 THEN substring(c.content, 1, 200) || '...'
        ELSE c.content
      END AS text_preview,
      FALSE AS is_chunk,
      NULL::INTEGER AS chunk_index,
      p.title AS parent_title,
      p.subreddit
    FROM reddit_comments c
    JOIN reddit_posts p ON c.post_id = p.id
    WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT 50
  ),
  
  -- Search in chunk-level embeddings
  chunk_results AS (
    SELECT 
      c.parent_id AS id,
      c.content_type,
      CASE WHEN c.content_type = 'post' THEN p.title ELSE NULL END AS title,
      c.similarity::DOUBLE PRECISION,
      c.chunk_text AS text_preview,
      TRUE AS is_chunk,
      c.chunk_index,
      CASE 
        WHEN c.content_type = 'comment' THEN p2.title
        ELSE NULL
      END AS parent_title,
      CASE
        WHEN c.content_type = 'post' THEN p.subreddit
        ELSE p2.subreddit
      END AS subreddit
    FROM 
      public.search_content_chunks(query_embedding, similarity_threshold_chunks::FLOAT, 50) c
    LEFT JOIN reddit_posts p ON c.content_type = 'post' AND c.parent_id = p.id
    LEFT JOIN reddit_comments cm ON c.content_type = 'comment' AND c.parent_id = cm.id
    LEFT JOIN reddit_posts p2 ON cm.post_id = p2.id
  )
  
  -- Combine and rank results with weighting
  SELECT * FROM (
    -- Document-level results with weight adjustment
    SELECT 
      id, 
      content_type, 
      title, 
      (similarity * docs_weight)::DOUBLE PRECISION AS similarity, 
      text_preview,
      is_chunk,
      chunk_index,
      parent_title,
      subreddit
    FROM post_results
    
    UNION ALL
    
    SELECT 
      id, 
      content_type, 
      title, 
      (similarity * docs_weight)::DOUBLE PRECISION AS similarity, 
      text_preview,
      is_chunk,
      chunk_index,
      parent_title,
      subreddit
    FROM comment_results
    
    UNION ALL
    
    -- Chunk-level results (already weighted in the function)
    SELECT 
      id, 
      content_type, 
      title, 
      similarity, 
      text_preview,
      is_chunk,
      chunk_index,
      parent_title,
      subreddit
    FROM chunk_results
  ) combined
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Add comments to the function for documentation
COMMENT ON FUNCTION public.parallel_search IS 
'Performs a semantic search across both document-level embeddings (reddit_posts and reddit_comments tables) 
and chunk-level embeddings (content_chunks table), combining the results for comprehensive search results.

Parameters:
- search_query: The text query to search for
- similarity_threshold_docs: Minimum similarity score for document results (default: 0.65)
- similarity_threshold_chunks: Minimum similarity score for chunk results (default: 0.7)
- docs_weight: Weight applied to document-level results (default: 0.8)
- max_results: Maximum number of results to return (default: 15)

Return values:
- id: The ID of the post, comment, or parent of a chunk
- content_type: Either "post" or "comment"
- title: Title of the post (null for comments)
- similarity: The weighted similarity score
- text_preview: Preview of the matching content
- is_chunk: Whether the result is from chunk-level search
- chunk_index: The index of the chunk (null for document results)
- parent_title: For comments, the title of the parent post
- subreddit: The subreddit of the post

Example usage:
SELECT * FROM public.parallel_search(''What is GPT-4?'', 0.6, 0.65, 0.75, 20);
';

-- Grant access to the function for authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.parallel_search TO authenticated, anon; 