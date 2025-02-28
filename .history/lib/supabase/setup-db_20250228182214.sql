-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the reddit_posts table
CREATE TABLE IF NOT EXISTS reddit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL,
  subreddit TEXT NOT NULL,
  author TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB
);

-- Create the queries table to log user queries
CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  embedding VECTOR(1536),
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on the embedding column for faster similarity search
CREATE INDEX IF NOT EXISTS reddit_posts_embedding_idx ON reddit_posts 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create a function to enable the pgvector extension
CREATE OR REPLACE FUNCTION enable_pgvector_extension()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Create a function to match documents based on vector similarity
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  post_id TEXT,
  title TEXT,
  content TEXT,
  url TEXT,
  subreddit TEXT,
  author TEXT,
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rp.id,
    rp.post_id,
    rp.title,
    rp.content,
    rp.url,
    rp.subreddit,
    rp.author,
    rp.score,
    rp.created_at,
    1 - (rp.embedding <=> query_embedding) AS similarity
  FROM reddit_posts rp
  WHERE 1 - (rp.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$; 