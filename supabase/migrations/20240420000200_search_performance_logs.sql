-- Migration to implement search performance logging
-- This creates a simple table to track search performance and usage

-- Create search performance logs table
CREATE TABLE IF NOT EXISTS public.search_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,                         -- The search query text
  intent TEXT,                                 -- Query intent if available
  vector_weight DOUBLE PRECISION,              -- Weight used for vector score
  text_weight DOUBLE PRECISION,                -- Weight used for text score
  ef_search INTEGER,                           -- HNSW search parameter used
  duration_ms DOUBLE PRECISION NOT NULL,       -- Total search duration in ms
  result_count INTEGER NOT NULL,               -- Number of results returned
  timed_out BOOLEAN DEFAULT FALSE,             -- Whether search timed out
  created_at TIMESTAMPTZ DEFAULT NOW()         -- When the search was performed
);

-- Add index for efficient querying by time
CREATE INDEX search_performance_logs_created_at_idx ON public.search_performance_logs (created_at);

-- Create function to log search performance
CREATE OR REPLACE FUNCTION public.log_search_performance(
  p_query text,
  p_intent text DEFAULT NULL,
  p_vector_weight double precision DEFAULT 0.7,
  p_text_weight double precision DEFAULT 0.3,
  p_ef_search integer DEFAULT 100,
  p_duration_ms double precision DEFAULT NULL,
  p_result_count integer DEFAULT 0,
  p_timed_out boolean DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.search_performance_logs (
    query, intent, vector_weight, text_weight, 
    ef_search, duration_ms, result_count, timed_out
  ) VALUES (
    p_query, p_intent, p_vector_weight, p_text_weight, 
    p_ef_search, COALESCE(p_duration_ms, 0), p_result_count, p_timed_out
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Add comments to document the table and function
COMMENT ON TABLE public.search_performance_logs IS 'Tracks search performance metrics and usage patterns';
COMMENT ON FUNCTION public.log_search_performance IS 'Logs search performance data for analysis';

-- Grant permissions
GRANT SELECT ON public.search_performance_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_search_performance TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_search_performance TO service_role; 