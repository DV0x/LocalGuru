# Embed Edge Function

This Edge Function processes embedding generation jobs from the database queue and updates records with the generated embeddings.

## How It Works

1. The function processes batches of embedding generation jobs from the `embedding_queue` in PostgreSQL
2. For each job, it:
   - Retrieves the content to embed using the specified content function
   - Generates an embedding using OpenAI's embedding API
   - Updates the record with the generated embedding
   - Removes the job from the queue when completed successfully

## Required Environment Variables

These are automatically provided by Supabase:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

You need to manually set this one:
- `OPENAI_API_KEY` - Your OpenAI API key

## Deploying

```bash
# Set up the OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Deploy the function
supabase functions deploy embed
```

## Testing

You can test this function by inserting a record into one of the tables with automatic embedding triggers:

```sql
-- Insert a test post
INSERT INTO reddit_posts (id, subreddit, title, content, author_id)
VALUES ('test123', 'test', 'Test Post', 'This is a test post.', 'test_user');

-- Wait a few seconds for processing, then check the embedding
SELECT id, embedding IS NOT NULL as has_embedding FROM reddit_posts WHERE id = 'test123';
```

## Development

```bash
# Start the function locally
supabase functions serve embed --env-file .env.local
``` 