-- Migration: Create reddit_users table
-- Description: Creates a table to store Reddit user information

-- Create the reddit_users table
CREATE TABLE reddit_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_bot BOOLEAN DEFAULT FALSE,
  data JSONB
);

-- Create an index on the username field for faster lookups
CREATE INDEX idx_reddit_users_username ON reddit_users (username);

-- Add table comment
COMMENT ON TABLE reddit_users IS 'Stores information about Reddit users whose content is imported';

-- Enable Row Level Security (RLS)
ALTER TABLE reddit_users ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
-- Policy for anon users to select
CREATE POLICY "Allow anonymous select on reddit_users" 
ON reddit_users FOR SELECT 
TO anon
USING (true);

-- Policy for authenticated users to select
CREATE POLICY "Allow authenticated select on reddit_users" 
ON reddit_users FOR SELECT 
TO authenticated
USING (true); 