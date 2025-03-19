# Automatic Embedding System Guide

This guide explains how to use the automatic embedding system without relying on PostgreSQL extensions `net` and `pg_cron` which aren't available in standard Supabase instances.

## Architecture

The automatic embedding system consists of:

1. **Trigger-Based Job Creation**
   - Database triggers that automatically add jobs to a queue table when content is created or updated
   - The queue table (`util.embedding_queue`) tracks jobs and their status

2. **Edge Function Processor**
   - An Edge Function (`process-queue`) that fetches and processes pending jobs from the queue
   - Generates embeddings using OpenAI API and updates the original records

3. **External Scheduler**
   - A scheduler script that calls the Edge Function periodically 
   - Can run on any system (local computer, cloud server, CI/CD system)

## Setup Instructions

### Step 1: Database Migrations (Already Done)

The migrations have been applied, creating:
- The `util.embedding_queue` table
- Trigger functions to queue embedding jobs
- Triggers on tables to automatically call these functions

### Step 2: Edge Function Deployment (Already Done)

You've deployed two Edge Functions:
- `embed` - The main function that processes embedding jobs sent to it
- `process-queue` - The function that fetches pending jobs and processes them

### Step 3: Get Your Supabase Anon Key

1. Go to your Supabase Dashboard > Settings > API
2. Copy your "anon" public API key
3. Edit the `schedule-embedding-processor.js` script and replace `YOUR_SUPABASE_ANON_KEY` with your actual key

### Step 4: Set Up the Scheduler

#### Option 1: Run the Provided Node.js Script

1. Make sure Node.js is installed on your system
2. Run: `node schedule-embedding-processor.js`
3. The script will run continuously, calling the processor every 30 seconds

#### Option 2: Use a Cron Job on a Server

Add a cron job that calls the Edge Function directly:

```bash
# Run every minute
* * * * * curl -X POST "https://ghjbtvyalvigvmuodaas.supabase.co/functions/v1/process-queue" -H "Authorization: Bearer YOUR_ANON_KEY" -H "Content-Type: application/json"
```

#### Option 3: Use GitHub Actions

Create a GitHub Action workflow that runs periodically:

```yaml
name: Process Embedding Queue

on:
  schedule:
    - cron: '*/5 * * * *'  # Run every 5 minutes
  workflow_dispatch:  # Allow manual triggers

jobs:
  process-queue:
    runs-on: ubuntu-latest
    steps:
      - name: Call Embedding Processor
        run: |
          curl -X POST "https://ghjbtvyalvigvmuodaas.supabase.co/functions/v1/process-queue" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

## Testing the System

1. Insert a test record:

```sql
-- First create a test user if needed
INSERT INTO reddit_users (id, username, created_at) 
VALUES ('test_user', 'testuser', now());

-- Then insert a test post
INSERT INTO reddit_posts (id, subreddit, title, content, author_id)
VALUES ('test_embedding_system', 'test', 'Testing Embeddings', 'This is a test post for the new embedding system.', 'test_user');
```

2. Verify a job was added to the queue:

```sql
SELECT * FROM util.embedding_queue WHERE record_id = 'test_embedding_system';
```

3. Manually trigger the processor (or wait for the scheduler):

```bash
curl -X POST "https://ghjbtvyalvigvmuodaas.supabase.co/functions/v1/process-queue" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

4. Check if the embedding was generated:

```sql
SELECT id, embedding IS NOT NULL as has_embedding 
FROM reddit_posts 
WHERE id = 'test_embedding_system';
```

## Troubleshooting

If embeddings aren't being generated:

1. Check the queue status:
```sql
SELECT * FROM util.embedding_queue ORDER BY created_at DESC LIMIT 10;
```

2. Look for jobs in a "failed" state and check their error messages
3. Make sure your OpenAI API key is correctly set in the Edge Function environment
4. Test the Edge Function directly using the curl commands above
5. Check the Edge Function logs in your Supabase Dashboard 