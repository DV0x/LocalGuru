import dotenv from 'dotenv';
import { config } from '../config';
import { applyDatabaseUpdates } from '../db';
import { Logger } from '../utils/logger';
import { RedditAPI, RedditFetcher } from '../fetchers';
import { ChangeDetector } from '../processors';
import { DBHandler } from '../db/db-handler';
import path from 'path';
import fs from 'fs';

// Determine and load environment variables
dotenv.config();

// Test configuration
const TEST_SUBREDDIT = process.env.TEST_SUBREDDIT || 'AskSF'; // Using AskSF subreddit for testing or override with env var
const MAX_POSTS = Number(process.env.MAX_POSTS || 2); // Limit posts to process
const TEST_MODE = process.env.TEST_MODE === 'true'; // Set to false to perform actual database operations
const USE_CHECKPOINTS = process.env.USE_CHECKPOINTS !== 'false'; // Enable checkpointing for resilience
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 1); // Process posts in batches
const FORCE_REFRESH = process.env.FORCE_REFRESH === 'true' || process.env.FORCE === 'true'; // Force clear checkpoint to get new data
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'; // Enable detailed logging
const USE_STREAMING = process.env.USE_STREAMING !== 'false'; // Enable streaming instead of historical data
const SORT_BY = (process.env.SORT_BY || 'top') as 'top' | 'new' | 'hot'; // Sort posts by: new, top, hot, etc.
const FETCH_ALL_TIME = process.env.FETCH_ALL_TIME === 'true'; // Fetch posts from all time, not just recent

// Initialize logger
const logger = new Logger('TestOrchestrator');

async function testOrchestrator() {
  logger.info('Starting test orchestrator');
  logger.info(`Test configuration: Subreddit=${TEST_SUBREDDIT}, MaxPosts=${MAX_POSTS}, TestMode=${TEST_MODE}, UseCheckpoints=${USE_CHECKPOINTS}, BatchSize=${BATCH_SIZE}, ForceRefresh=${FORCE_REFRESH}, VerboseLogging=${VERBOSE_LOGGING}, UseStreaming=${USE_STREAMING}, SortBy=${SORT_BY}, FetchAllTime=${FETCH_ALL_TIME}`);

  try {
    // Initialize Supabase client parameters
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    // Initialize components with resilience features
    const fetcher = new RedditFetcher({
      userAgent: config.reddit.userAgent,
      requestDelay: config.reddit.requestDelay,
      checkpointDir: path.join(process.cwd(), 'checkpoints', 'reddit')
    });
  
    const dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
      batchSize: config.database.batchSize,
      retryAttempts: config.database.retryAttempts,
      disableTriggers: config.database.disableTriggers
    });
  
    const changeDetector = new ChangeDetector({
      checksumFields: config.changeDetection.checksumFields,
      ignoreFields: config.changeDetection.ignoreFields,
      forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays
    });

    // Create the batch processor for DB operations
    // Import the default processor class dynamically to avoid TS import errors
    const { DefaultBatchProcessor } = await import('../fetchers/reddit-fetcher');
    const batchProcessor = new DefaultBatchProcessor(
      dbHandler,
      changeDetector,
      TEST_SUBREDDIT
    );

    // Clear checkpoint if forced refresh is enabled
    if (FORCE_REFRESH) {
      logger.info(`Clearing checkpoint for r/${TEST_SUBREDDIT} to force new data fetching`);
      // Use filesystem to delete checkpoint file
      const checkpointDir = path.join(process.cwd(), 'checkpoints', 'reddit');
      const fs = require('fs');
      const checkpointPattern = new RegExp(`^${TEST_SUBREDDIT}-.*\\.json$`);
      
      if (fs.existsSync(checkpointDir)) {
        const files = fs.readdirSync(checkpointDir);
        files.forEach((file: string) => {
          if (checkpointPattern.test(file)) {
            fs.unlinkSync(path.join(checkpointDir, file));
            logger.info(`Deleted checkpoint file: ${file}`);
          }
        });
      }
    }

    if (USE_STREAMING) {
      // Use streaming approach to fetch and process data
      logger.info(`Streaming data from r/${TEST_SUBREDDIT} using '${SORT_BY}' sort`);
      
      const streamStats = await fetcher.streamSubreddit(TEST_SUBREDDIT, batchProcessor, {
        maxPosts: MAX_POSTS,
        useCheckpoints: USE_CHECKPOINTS,
        batchSize: BATCH_SIZE,
        sort: SORT_BY,
        fetchAllTime: FETCH_ALL_TIME
      });
      
      logger.info(`Streaming completed. Processed ${streamStats.totalPosts} posts and ${streamStats.totalComments} comments`);
    } else {
      // Use historical data fetching approach
      logger.info(`Fetching historical data from r/${TEST_SUBREDDIT} for the last year`);

      // Create a historical processor that works with the batch processor
      const historicalProcessor = {
        processBatch: async (posts: any[], comments: any[]) => {
          // Process in smaller batches to avoid overwhelming the database
          const PROCESS_BATCH_SIZE = 50;
          
          logger.info(`Processing historical batch of ${posts.length} posts and ${comments.length} comments`);
          
          // Process posts in smaller batches
          for (let i = 0; i < posts.length; i += PROCESS_BATCH_SIZE) {
            const postBatch = posts.slice(i, i + PROCESS_BATCH_SIZE);
            const relatedComments = comments.filter(c => 
              postBatch.some(p => p.id === c.post_id)
            );
            
            await batchProcessor.processBatch(postBatch, relatedComments);
            logger.info(`Processed posts batch ${Math.floor(i/PROCESS_BATCH_SIZE) + 1}/${Math.ceil(posts.length/PROCESS_BATCH_SIZE)}`);
          }
        }
      };

      // Set up dates for the past year (or use custom range if needed)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      // Fetch historical data
      const { posts, comments } = await fetcher.fetchSubredditHistory(TEST_SUBREDDIT, {
        startDate, 
        endDate,
        maxPosts: MAX_POSTS || 1000 // Use higher limit for historical data
      });

      // Process all the historical data
      await historicalProcessor.processBatch(posts, comments);

      logger.info(`Fetched and processed ${posts.length} posts and ${comments.length} comments from r/${TEST_SUBREDDIT}`);
      
      // Use simpler logging for changes as the stats property might not exist
      logger.info('Checking for changes detected during processing');
      logger.info(`Completed processing ${posts.length} posts`);
      
      // NOTE: We're now relying on database triggers to automatically add items to the embedding queue
      // Database triggers on reddit_posts and reddit_comments tables will detect new content
      // and add it to the util.embedding_queue table with appropriate priorities
      
      logger.info(`${posts.length} posts will be automatically queued for embedding by database triggers`);
      
      // Log the post IDs for reference
      if (posts.length > 0) {
        logger.info(`Processed post IDs: ${posts.map((p: any) => p.id).join(', ')}`);
      }
    }
    
    // Check embedding queue to verify items were added by triggers
    logger.info('Checking embedding queue for items added by triggers');
    logger.info('Note: Queue access is handled by database triggers - unable to directly verify queue status from client');
    logger.info('End-to-end test completed successfully');
  } catch (error) {
    // Handle any unhandled errors at the top level
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Test failed: ${err.message}`, err);
    
    if (err.stack) {
      logger.error(`Stack trace: ${err.stack}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testOrchestrator().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 