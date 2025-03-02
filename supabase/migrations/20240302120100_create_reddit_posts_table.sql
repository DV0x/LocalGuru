-- Migration: Create reddit_posts table
-- Description: Creates a table to store Reddit posts with vector embedding support for semantic search

-- Create the reddit_posts table with vector embedding support
CREATE TABLE reddit_posts (
  id TEXT PRIMARY KEY,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  permalink TEXT,
  author_id TEXT REFERENCES reddit_users(id),
  created_at TIMESTAMP WITH TIME ZONE,
  score INTEGER DEFAULT 0,
  upvote_ratio DECIMAL(5,4),
  is_nsfw BOOLEAN DEFAULT FALSE,
  is_spoiler BOOLEAN DEFAULT FALSE,
  flair TEXT,
  is_self_post BOOLEAN DEFAULT TRUE,
  embedding VECTOR(1536),  -- Vector field for semantic search (OpenAI embedding dimension)
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_json JSONB
);

-- Create indexes for efficient queries
CREATE INDEX idx_reddit_posts_subreddit ON reddit_posts (subreddit);
CREATE INDEX idx_reddit_posts_author_id ON reddit_posts (author_id);
CREATE INDEX idx_reddit_posts_created_at ON reddit_posts (created_at);
CREATE INDEX idx_reddit_posts_search ON reddit_posts USING GIN (search_vector);

-- Create vector index for similarity search using IVFFLAT
-- This index is optimized for approximate nearest neighbor search
CREATE INDEX idx_reddit_posts_embedding ON reddit_posts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add table comment
COMMENT ON TABLE reddit_posts IS 'Stores Reddit posts with vector embeddings for semantic search';

-- Enable Row Level Security (RLS)
ALTER TABLE reddit_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
-- Policy for anon users to select
CREATE POLICY "Allow anonymous select on reddit_posts" 
ON reddit_posts FOR SELECT 
TO anon
USING (true);

-- Policy for authenticated users to select
CREATE POLICY "Allow authenticated select on reddit_posts" 
ON reddit_posts FOR SELECT 
TO authenticated
USING (true); 