-- parallel_search function for performing searches across multiple content types in parallel
CREATE OR REPLACE FUNCTION public.parallel_search(
  max_results INTEGER,
  search_query TEXT,
  similarity_threshold_chunks FLOAT DEFAULT 0.5,
  similarity_threshold_docs FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  subreddit TEXT,
  title TEXT,
  content TEXT,
  author_id TEXT,
  match_type TEXT,
  similarity FLOAT,
  post_id TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- Generate embedding for the search query
  query_embedding := public.generate_embeddings(search_query);
  
  -- Return results from both posts and comments with match_type indicator
  RETURN QUERY
  (
    -- Search in posts
    SELECT 
      p.id::TEXT,
      'post' AS content_type,
      p.subreddit,
      p.title,
      p.content,
      p.author_id,
      'vector_similarity' AS match_type,
      (1 - (p.embedding <=> query_embedding)) AS similarity,
      NULL AS post_id
    FROM public.reddit_posts p
    WHERE (1 - (p.embedding <=> query_embedding)) > similarity_threshold_docs
    ORDER BY similarity DESC
    LIMIT (max_results / 2)
  )
  UNION ALL
  (
    -- Search in comments
    SELECT 
      c.id::TEXT,
      'comment' AS content_type,
      NULL AS subreddit,
      '' AS title,
      c.content,
      c.author_id,
      'vector_similarity' AS match_type,
      (1 - (c.embedding <=> query_embedding)) AS similarity,
      c.post_id::TEXT
    FROM public.reddit_comments c
    WHERE (1 - (c.embedding <=> query_embedding)) > similarity_threshold_chunks
    ORDER BY similarity DESC
    LIMIT (max_results / 2)
  )
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.parallel_search(INTEGER, TEXT, FLOAT, FLOAT) TO service_role;
GRANT EXECUTE ON FUNCTION public.parallel_search(INTEGER, TEXT, FLOAT, FLOAT) TO anon;
GRANT EXECUTE ON FUNCTION public.parallel_search(INTEGER, TEXT, FLOAT, FLOAT) TO authenticated; 