-- Migration to add enhanced content representation for better search
-- Creates multi-part embeddings and metadata extraction fields

-- Create content representations table for multi-part embeddings
CREATE TABLE IF NOT EXISTS content_representations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id TEXT NOT NULL, -- post_id or comment_id
  content_type TEXT NOT NULL, -- 'post' or 'comment'
  representation_type TEXT NOT NULL, -- 'full', 'title', 'body', 'context_enhanced'
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_content_representation UNIQUE (parent_id, content_type, representation_type)
);

-- Add metadata extraction fields to posts
ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
  extracted_entities JSONB DEFAULT '{}';
ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
  extracted_topics TEXT[] DEFAULT '{}';
ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
  extracted_locations TEXT[] DEFAULT '{}';
ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
  semantic_tags TEXT[] DEFAULT '{}';

-- Add similar fields to comments
ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS 
  extracted_entities JSONB DEFAULT '{}';
ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS 
  extracted_topics TEXT[] DEFAULT '{}';
ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS 
  thread_context TEXT; -- Store conversation context

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS content_representations_parent_idx ON 
  content_representations(parent_id);
CREATE INDEX IF NOT EXISTS content_representations_type_idx ON 
  content_representations(content_type, representation_type);
CREATE INDEX IF NOT EXISTS content_representations_embedding_idx ON 
  content_representations USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Create function to refresh content representations
CREATE OR REPLACE FUNCTION refresh_content_representations(
  refresh_type TEXT DEFAULT 'all', -- 'all', 'posts', 'comments'
  batch_size INTEGER DEFAULT 100
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue posts for reprocessing
  IF refresh_type IN ('all', 'posts') THEN
    INSERT INTO embedding_queue (content_id, content_type, status, priority)
    SELECT 
      id, 
      'post', 
      'pending', 
      5 -- Higher priority
    FROM 
      reddit_posts
    WHERE 
      NOT EXISTS (
        SELECT 1 FROM content_representations 
        WHERE parent_id = id AND content_type = 'post' AND representation_type = 'full'
      )
    LIMIT batch_size;
  END IF;
  
  -- Queue comments for reprocessing
  IF refresh_type IN ('all', 'comments') THEN
    INSERT INTO embedding_queue (content_id, content_type, status, priority)
    SELECT 
      id, 
      'comment', 
      'pending', 
      3 -- Lower priority than posts
    FROM 
      reddit_comments
    WHERE 
      NOT EXISTS (
        SELECT 1 FROM content_representations 
        WHERE parent_id = id AND content_type = 'comment' AND representation_type = 'full'
      )
    LIMIT batch_size;
  END IF;
END;
$$;
