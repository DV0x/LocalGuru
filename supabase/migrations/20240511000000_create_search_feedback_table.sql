-- Create search_feedback table to track user feedback on search results
CREATE TABLE IF NOT EXISTS public.search_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id TEXT NOT NULL,
  query TEXT NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  feedback_source TEXT NOT NULL,
  feedback_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_search_feedback_content_id ON public.search_feedback(content_id);
CREATE INDEX IF NOT EXISTS idx_search_feedback_query ON public.search_feedback(query);
CREATE INDEX IF NOT EXISTS idx_search_feedback_created_at ON public.search_feedback(created_at);

-- Add RLS policies
ALTER TABLE public.search_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own feedback
CREATE POLICY "Allow authenticated users to insert feedback" 
ON public.search_feedback 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow anonymous users to insert feedback without authentication
CREATE POLICY "Allow anonymous users to insert feedback" 
ON public.search_feedback 
FOR INSERT 
TO anon 
WITH CHECK (user_id IS NULL);

-- Only allow admins to view all feedback
CREATE POLICY "Allow admins to view all feedback" 
ON public.search_feedback 
FOR SELECT 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin');

-- Add function to get search feedback statistics
CREATE OR REPLACE FUNCTION public.get_search_feedback_stats(
  time_period TEXT DEFAULT 'all'
)
RETURNS TABLE (
  query TEXT,
  total_searches BIGINT,
  positive_feedback BIGINT,
  negative_feedback BIGINT,
  feedback_rate NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH feedback_data AS (
    SELECT
      query,
      COUNT(*) AS total,
      SUM(CASE WHEN is_helpful THEN 1 ELSE 0 END) AS positive,
      SUM(CASE WHEN NOT is_helpful THEN 1 ELSE 0 END) AS negative
    FROM public.search_feedback
    WHERE
      CASE
        WHEN time_period = 'day' THEN created_at >= NOW() - INTERVAL '1 day'
        WHEN time_period = 'week' THEN created_at >= NOW() - INTERVAL '1 week'
        WHEN time_period = 'month' THEN created_at >= NOW() - INTERVAL '1 month'
        ELSE TRUE
      END
    GROUP BY query
  )
  SELECT
    query,
    total AS total_searches,
    positive AS positive_feedback,
    negative AS negative_feedback,
    ROUND((positive::NUMERIC / NULLIF(total, 0)) * 100, 2) AS feedback_rate
  FROM feedback_data
  ORDER BY total DESC
  LIMIT 100;
$$; 