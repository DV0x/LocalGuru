-- Add PARALLEL SAFE to the multi_strategy_search function
-- This allows PostgreSQL to parallelize the function execution
ALTER FUNCTION multi_strategy_search SET parallel_workers = 4;

-- Create a wrapper function with increased statement timeout
CREATE OR REPLACE FUNCTION timed_multi_strategy_search(
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
BEGIN
  -- Set a higher statement timeout just for this function call
  SET LOCAL statement_timeout = '30s';
  
  -- Call the original function with a lower threshold for better recall with larger datasets
  RETURN QUERY
  SELECT * FROM multi_strategy_search(
    p_query, 
    p_query_embedding,
    p_query_intent,
    p_query_topics,
    p_query_locations,
    p_max_results,
    p_match_threshold * 0.6 -- Lower threshold to ensure we get results
  );
END;
$$; 