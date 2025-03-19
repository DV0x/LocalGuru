-- Create content_chunks table for chunked content with embeddings
CREATE TABLE IF NOT EXISTS public.content_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints for organizing chunks
  CONSTRAINT unique_chunk_position UNIQUE (parent_id, chunk_index)
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS content_chunks_parent_id_idx ON public.content_chunks(parent_id);
CREATE INDEX IF NOT EXISTS content_chunks_content_type_idx ON public.content_chunks(content_type);

-- Add vector index for similarity search
CREATE INDEX IF NOT EXISTS content_chunks_embedding_idx ON public.content_chunks 
USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);

-- Function to get content chunks for a post/comment
CREATE OR REPLACE FUNCTION public.get_content_chunks(record_id TEXT)
RETURNS TABLE (
  chunk_id UUID,
  parent_id TEXT,
  content_type TEXT,
  chunk_index INTEGER,
  chunk_text TEXT
) 
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT 
    id AS chunk_id,
    parent_id,
    content_type,
    chunk_index,
    chunk_text
  FROM 
    public.content_chunks
  WHERE 
    parent_id = record_id
  ORDER BY 
    chunk_index ASC;
$$;

-- Function to perform vector similarity search across chunks
CREATE OR REPLACE FUNCTION public.search_content_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  chunk_id UUID,
  parent_id TEXT,
  content_type TEXT,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id AS chunk_id,
    parent_id,
    content_type,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM
    public.content_chunks
  WHERE
    embedding IS NOT NULL AND
    1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;

-- Monitor table to track embedding processing metrics
CREATE TABLE IF NOT EXISTS public.embedding_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  job_type TEXT NOT NULL, -- 'post', 'comment', etc.
  content_length INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  processing_time_ms INTEGER NOT NULL,
  subreddit TEXT,
  is_successful BOOLEAN NOT NULL,
  error_message TEXT
);

-- Add RLS to the embedding_metrics table
ALTER TABLE public.embedding_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view metrics
CREATE POLICY "Allow authenticated to view metrics" ON public.embedding_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- Add RLS to the content_chunks table
ALTER TABLE public.content_chunks ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view content chunks
CREATE POLICY "Allow public to view content chunks" ON public.content_chunks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Function to record embedding metrics
CREATE OR REPLACE FUNCTION public.record_embedding_metrics(
  p_job_type TEXT,
  p_content_length INTEGER,
  p_chunk_count INTEGER,
  p_processing_time_ms INTEGER,
  p_subreddit TEXT DEFAULT NULL,
  p_is_successful BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  metric_id UUID;
BEGIN
  INSERT INTO public.embedding_metrics (
    job_type, 
    content_length, 
    chunk_count, 
    processing_time_ms, 
    subreddit, 
    is_successful, 
    error_message
  ) VALUES (
    p_job_type,
    p_content_length,
    p_chunk_count,
    p_processing_time_ms,
    p_subreddit,
    p_is_successful,
    p_error_message
  )
  RETURNING id INTO metric_id;
  
  RETURN metric_id;
END;
$$; 