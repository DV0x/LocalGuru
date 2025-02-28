# Supabase Database Setup Instructions

Follow these steps to set up your Supabase database for the LocalGuru application:

## 1. Enable pgvector Extension

1. Log in to your Supabase dashboard at https://app.supabase.com/
2. Select your project
3. Go to the SQL Editor tab
4. Create a new query and paste the following SQL:

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

5. Click "Run" to execute the query

## 2. Create Tables and Functions

1. Create a new query in the SQL Editor
2. Paste the following SQL:

```sql
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
```

3. Click "Run" to execute the query

## 3. Create Vector Similarity Search Function

1. Create a new query in the SQL Editor
2. Paste the following SQL:

```sql
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
```

3. Click "Run" to execute the query

## 4. Verify Setup

1. Create a new query in the SQL Editor
2. Paste the following SQL to check if the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reddit_posts', 'queries');

-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'match_documents';
```

3. Click "Run" to execute the query
4. You should see both tables and the function listed in the results

## 5. Ingest Reddit Data

After setting up the database, run the data ingestion script to populate the database with Reddit posts:

```bash
node scripts/ingest-reddit-data.js
```

This will fetch travel-related posts from Reddit, generate embeddings using OpenAI, and store them in your Supabase database.

## 6. Test Vector Search

Once data is ingested, you can test the vector search functionality using the test page at:

```
http://localhost:3000/test
```

Use the Vector Search section to enter a travel query and see the most semantically similar Reddit posts. 