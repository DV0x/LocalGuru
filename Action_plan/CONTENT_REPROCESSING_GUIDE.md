# Content Reprocessing Guide

This guide explains how to use the newly implemented content reprocessing functionality to enhance your existing Reddit content with improved embeddings.

## Overview

We've successfully implemented two key components:

1. **SQL Functions**:
   - `refresh_content_representations` - Queues content for reprocessing
   - `get_content_representation_status` - Checks the status of content representation

2. **Processing Scripts**:
   - Command-line scripts for both interactive and automated batch processing

## Function Parameters

The correct signatures for our functions are:

```sql
-- Queue content for reprocessing
refresh_content_representations(
  refresh_type text DEFAULT 'all'::text,  -- 'posts', 'comments', or 'all'
  batch_size integer DEFAULT 100          -- Number of items per batch
)

-- Check the status of content representations
get_content_representation_status()
```

## Direct PostgreSQL Connection (Recommended)

We've created two scripts that use direct PostgreSQL connections:

1. **Interactive Testing Script**:
   ```bash
   ./scripts/direct-psql-connection.sh
   ```
   This script will:
   - Check if the function exists
   - Verify the embedding_queue table
   - Allow you to queue a small batch of posts for reprocessing
   - Provide a monitoring option

2. **Automated Reprocessing Script**:
   ```bash
   ./scripts/reprocess-all.sh
   ```
   This script will:
   - Process both posts and comments
   - Queue 10 batches of 10 items each
   - Include pauses between batches to avoid overwhelming the system
   - Show status reports before and after each content type

3. **Monitor Progress**:
   ```bash
   ./scripts/direct-psql-connection.sh monitor
   ```
   This continuously monitors:
   - Overall status of content representations
   - Number of pending and processing items in the queue

## Manual SQL Queries via Dashboard

You can also execute SQL directly in the Supabase dashboard:

```sql
-- Queue posts for reprocessing (10 at a time)
SELECT * FROM refresh_content_representations('posts', 10);

-- Queue comments for reprocessing
SELECT * FROM refresh_content_representations('comments', 10);

-- Check status
SELECT * FROM get_content_representation_status();

-- Check pending queue items
SELECT * FROM util.embedding_queue WHERE status = 'pending' LIMIT 10;

-- Check completed items
SELECT 
  COUNT(*) AS count,
  content_type 
FROM content_representations 
WHERE representation_type = 'context_enhanced' 
GROUP BY content_type;
```

## What's Happening Behind the Scenes

1. The `refresh_content_representations` function finds content (posts/comments) that needs enhanced embeddings
2. It adds entries to the `util.embedding_queue` table
3. The background embedding service processes these entries
4. New enhanced embeddings are stored in the `content_representations` table
5. These enhanced representations improve search quality dramatically

## Troubleshooting

If you encounter issues:

1. **Check function arguments**: The function now takes only two parameters: `refresh_type` and `batch_size`
2. **Verify the embedding_queue table**: We've confirmed that it exists in the `util` schema
3. **Monitor the console logs**: Watch for errors in the embedding processing service

## Success Verification

You can verify success by:

1. Checking if the number of items with context-enhanced representations increases
2. Checking if the embedding_queue items are being processed
3. Testing search quality with queries that should benefit from context-aware embeddings 