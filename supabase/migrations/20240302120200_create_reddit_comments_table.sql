-- Migration: Create reddit_comments table
-- Description: Creates a table to store Reddit comments with vector embedding support for semantic search

-- Create the reddit_comments table with vector embedding support
CREATE TABLE reddit_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES reddit_posts(id) ON DELETE CASCADE,
  parent_id TEXT,
  author_id TEXT REFERENCES reddit_users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  score INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  path TEXT[],  -- Stores the path of parent comments for hierarchical retrieval
  is_stickied BOOLEAN DEFAULT FALSE,
  embedding VECTOR(1536),  -- Vector field for semantic search (OpenAI embedding dimension)
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  original_json JSONB
);

-- Create indexes for efficient queries
CREATE INDEX idx_reddit_comments_post_id ON reddit_comments (post_id);
CREATE INDEX idx_reddit_comments_parent_id ON reddit_comments (parent_id);
CREATE INDEX idx_reddit_comments_author_id ON reddit_comments (author_id);
CREATE INDEX idx_reddit_comments_path ON reddit_comments USING GIN (path);
CREATE INDEX idx_reddit_comments_search ON reddit_comments USING GIN (search_vector);

-- Create vector index for similarity search using IVFFLAT
-- This index is optimized for approximate nearest neighbor search
CREATE INDEX idx_reddit_comments_embedding ON reddit_comments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add table comment
COMMENT ON TABLE reddit_comments IS 'Stores Reddit comments with vector embeddings for semantic search';

-- Enable Row Level Security (RLS)
ALTER TABLE reddit_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
-- Policy for anon users to select
CREATE POLICY "Allow anonymous select on reddit_comments" 
ON reddit_comments FOR SELECT 
TO anon
USING (true);

-- Policy for authenticated users to select
CREATE POLICY "Allow authenticated select on reddit_comments" 
ON reddit_comments FOR SELECT 
TO authenticated
USING (true); 