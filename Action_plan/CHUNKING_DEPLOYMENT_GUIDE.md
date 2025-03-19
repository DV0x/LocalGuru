# Reddit Data Chunking System Deployment Guide

This guide explains how to deploy, test, and use the new content chunking system for Reddit data in your Supabase project.

## Overview of Changes

The chunking system improves vector search by:

1. Splitting large content into semantically meaningful chunks
2. Preserving context between chunks with overlapping text
3. Storing chunks with their vectors in a dedicated table
4. Prioritizing embedding jobs based on importance
5. Processing jobs in batches with rate limiting and token budgeting
6. Providing detailed metrics and monitoring

## Deployment Steps

### 1. Database Migrations (Already Completed)

The following migrations have been applied:

- `20240309000000_content_chunks.sql`: Creates the `content_chunks` table and related functions
- `20240309000100_enhanced_embedding_queue.sql`: Enhances the queue with priority-based processing
- `20240309000200_queue_stats_function.sql`: Adds metrics and monitoring capabilities

### 2. Deploy Edge Functions

You can deploy the edge functions in two ways:

#### Option 1: Using Supabase CLI Without Docker (Recommended)

```bash
# Deploy the embed function
supabase functions deploy embed --use-api --no-verify-jwt

# Deploy the process-queue function
supabase functions deploy process-queue --use-api --no-verify-jwt

# Deploy the queue-stats function
supabase functions deploy queue-stats --use-api --no-verify-jwt
```

The `--use-api` flag uses the Supabase Management API to bundle functions instead of Docker.

#### Option 2: Through the Supabase Dashboard

If you prefer a visual interface:

1. Go to the Supabase dashboard > Edge Functions
2. Select or create each function (`embed`, `process-queue`, `queue-stats`)
3. Replace the code with the updated version from the respective files in `supabase/functions/`
4. Deploy each function

### 3. Update Scheduler Script (Optional)

The enhanced scheduler script provides more control over processing:

1. Update the `schedule-embedding-processor.js` with the new version
2. Set appropriate environment variables based on your needs
3. Restart the scheduler

## Testing the Chunking System

### Basic Test

1. Insert a test record:

```sql
-- First create a test user if needed
INSERT INTO reddit_users (id, username, created_at) 
VALUES ('test_chunking_user', 'testuser', now());

-- Then insert a test post with long content
INSERT INTO reddit_posts (id, subreddit, title, content, author_id)
VALUES (
  'test_chunking_system', 
  'test', 
  'Testing Chunking System', 
  'This is a test post for the new chunking system. It contains multiple paragraphs to demonstrate how the intelligent chunking works.

  The chunker will split this content into semantic chunks based on paragraphs and optimal chunk size. Longer content will be split while preserving context.
  
  Each chunk will get its own embedding vector, making search more accurate for specific pieces of content within large documents or comments.
  
  This approach works particularly well for Reddit content which often contains multiple distinct topics within a single post or comment.
  
  The system also prioritizes processing based on content importance and manages rate limits intelligently.', 
  'test_chunking_user'
);
```

2. Check that a job was added to the queue:

```sql
SELECT * FROM util.embedding_queue WHERE record_id = 'test_chunking_system';
```

3. Trigger processing:

```bash
# Get your project ref and anon key from the Supabase dashboard
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-queue" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

4. Verify chunks were created:

```sql
SELECT * FROM public.content_chunks WHERE parent_id = 'test_chunking_system';
```

### Monitoring

1. Check queue stats:

```bash
# Get your project ref and anon key from the Supabase dashboard
curl -X GET "https://YOUR_PROJECT_REF.supabase.co/functions/v1/queue-stats" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

2. View processing metrics:

```sql
SELECT * FROM public.embedding_metrics_summary;
```

## Using the Chunking System in Searches

### Basic Vector Search Across Chunks

```sql
-- Get embedding for query
WITH query_embedding AS (
  SELECT openai.embed('What is the chunking system?') AS embedding
)
-- Search across chunks
SELECT 
  c.parent_id,
  c.chunk_text,
  c.similarity,
  CASE 
    WHEN p.id IS NOT NULL THEN p.title
    WHEN cm.id IS NOT NULL THEN 'Comment in post: ' || p2.title
    ELSE 'Unknown'
  END AS source
FROM 
  public.search_content_chunks(
    (SELECT embedding FROM query_embedding),
    0.7,  -- similarity threshold
    10    -- max results
  ) c
LEFT JOIN reddit_posts p ON (c.content_type = 'post' AND c.parent_id = p.id)
LEFT JOIN reddit_comments cm ON (c.content_type = 'comment' AND c.parent_id = cm.id)
LEFT JOIN reddit_posts p2 ON (cm.post_id = p2.id)
ORDER BY c.similarity DESC;
```

## Advanced Features

### Prioritized Processing

Use different priority triggers for different content types:

```sql
-- Create a trigger for high-priority content (e.g., trending posts)
CREATE TRIGGER queue_trending_posts_embedding
AFTER INSERT OR UPDATE ON reddit_posts
FOR EACH ROW
WHEN (NEW.score > 100 AND NEW.embedding IS NULL)
EXECUTE FUNCTION util.queue_embeddings_high_priority('get_post_content', 'embedding');

-- Create a trigger for normal-priority content
CREATE TRIGGER queue_normal_posts_embedding
AFTER INSERT OR UPDATE ON reddit_posts
FOR EACH ROW
WHEN (NEW.score BETWEEN 10 AND 100 AND NEW.embedding IS NULL)
EXECUTE FUNCTION util.queue_embeddings_normal_priority('get_post_content', 'embedding');
```

### Targeted Processing

Process specific subreddits or content types:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-queue" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"subreddit": "programming", "min_priority": 5, "batch_size": 20}'
```

## Troubleshooting

If chunks aren't being created:

1. Check the queue status:
```sql
SELECT * FROM util.embedding_queue ORDER BY created_at DESC LIMIT 10;
```

2. Look for error messages in failed jobs:
```sql
SELECT * FROM util.embedding_queue WHERE status = 'failed' ORDER BY processed_at DESC LIMIT 10;
```

3. Check metrics for processing issues:
```sql
SELECT * FROM public.embedding_metrics WHERE is_successful = false ORDER BY timestamp DESC LIMIT 10;
```

4. Verify Edge Function logs in the Supabase dashboard 