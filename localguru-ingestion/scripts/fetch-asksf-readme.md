# AskSF Subreddit Historical Data Ingestion

This script fetches a year's worth of historical data from the r/AskSF subreddit using a scalable, memory-efficient approach. It processes the data in batches and uses checkpoints to allow resuming if the script fails.

## Features

- Processes data in quarters (3-month periods) to manage data volume
- Uses streaming approach to handle large amounts of data efficiently
- Implements both 'top' and 'new' post fetching for each quarter to ensure comprehensive coverage
- Creates checkpoints for resumability if the script fails
- Leverages database triggers for automatic embedding queue management
- Provides detailed logging for monitoring progress

## Prerequisites

1. Ensure you have Node.js and npm installed
2. Set up the `.env` file with the following variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   REDDIT_USER_AGENT=Localguru/1.0
   REDDIT_REQUEST_DELAY=2000
   ```

## Running the Script

### Option 1: Using npm script

```bash
# From the project root directory
npm run fetch:asksf
```

### Option 2: Using ts-node directly

```bash
# From the project root directory
npx ts-node src/scripts/asksf-historical-stream.ts
```

### Option 3: Using built version

```bash
# Build the project first
npm run build

# Then run the compiled script
node dist/scripts/asksf-historical-stream.js
```

## Monitoring Progress

The script will output detailed logs of the progress. You can monitor:

1. Number of posts and comments processed in each batch
2. Number of new/updated items inserted into the database
3. Final count of posts and comments after completion

## Recovery

If the script fails, you can simply run it again. It will resume from the last checkpoint.

To start fresh (ignore previous progress):
1. Delete the checkpoint files from the `checkpoints/AskSF/` directory
2. Run the script again

## Verifying Results

After running the script, you can verify the data in Supabase using these queries:

```sql
-- Check total posts from AskSF
SELECT COUNT(*) FROM reddit_posts WHERE subreddit = 'AskSF';

-- Check embedding queue status
SELECT status, COUNT(*) 
FROM util.embedding_queue 
WHERE table_name = 'reddit_posts' 
  AND subreddit = 'AskSF'
GROUP BY status;
``` 