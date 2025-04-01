/**
 * AskSF Posts-Only Fetcher
 * 
 * This script only fetches and inserts posts from r/AskSF, skipping updates and comments
 * to avoid issues with the search_vector generated column.
 */

import dotenv from 'dotenv';
import path from 'path';
import { Logger } from '../utils/logger';
import { DBHandler } from '../db/db-handler';
import { RedditFetcher, RedditPost, RedditComment } from '../fetchers';
import { ChangeDetector } from '../processors';
import { config } from '../config';

// Load environment variables
dotenv.config();

// Create logger
const logger = new Logger('AskSFPostsOnly');

// Configuration
const SUBREDDIT = 'AskSF';
const MAX_RETRIES = 8;
const BATCH_SIZE = 10; // Smaller batch size for better reliability
const NETWORK_RETRY_DELAY = 20000; // 20 seconds
const BATCH_PAUSE = 10000; // 10 seconds
const ERROR_PAUSE = 30000; // 30 seconds

// Quarter to fetch
const QUARTER = { name: 'New Posts', sort: 'new', time: 'all' };

// Global stats to track progress
const stats = {
  startTime: new Date(),
  batchesProcessed: 0,
  postsProcessed: 0,
  newPostsInserted: 0,
  errorCount: 0,
  apiRequests: 0
};

// Format time elapsed
function formatTimeElapsed(startTime: Date): string {
  const elapsedMs = Date.now() - startTime.getTime();
  const seconds = Math.floor((elapsedMs / 1000) % 60);
  const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Print progress summary
function printProgressSummary(isComplete = false): void {
  const elapsedTime = formatTimeElapsed(stats.startTime);
  
  console.log('\n--- Progress Summary ---');
  console.log(`Time elapsed: ${elapsedTime}`);
  console.log(`Batches processed: ${stats.batchesProcessed}`);
  console.log(`Posts processed: ${stats.postsProcessed}`);
  console.log(`New posts inserted: ${stats.newPostsInserted}`);
  console.log(`Error count: ${stats.errorCount}`);
  console.log(`API requests: ${stats.apiRequests}`);
  console.log(isComplete ? '--- Complete ---\n' : '--- In Progress ---\n');
}

// Track API requests
function trackApiRequest(): void {
  stats.apiRequests++;
  if (stats.apiRequests % 10 === 0) {
    logger.info(`API requests made: ${stats.apiRequests}`);
  }
}

// Sleep utility
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function fetchPostsOnly(): Promise<void> {
  logger.info('Starting AskSF posts-only fetch');
  console.log('🚀 Starting AskSF posts-only fetch');
  
  try {
    // Initialize Supabase client parameters
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }

    // Create required objects
    const dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
      batchSize: BATCH_SIZE,
      retryAttempts: 10,
      disableTriggers: false
    });
    
    // Create RedditFetcher with very lenient rate limiting
    const fetcher = new RedditFetcher({
      userAgent: 'LocalGuru/1.0',
      requestDelay: 5000, // 5 seconds between requests
      checkpointDir: path.join(process.cwd(), 'checkpoints', 'posts-only')
    });
    
    // Create change detector
    const changeDetector = new ChangeDetector({
      checksumFields: ['title', 'content', 'score'],
      ignoreFields: ['last_updated'],
      forceUpdateAfterDays: 7
    });
    
    // Define batch processor function - only handles posts, skips comments
    const processBatch = async (posts: RedditPost[], comments: RedditComment[]): Promise<void> => {
      // Increment batch counter
      stats.batchesProcessed++;
      stats.postsProcessed += posts.length;
      
      // Increment API counter for each batch
      trackApiRequest();
      
      logger.info(`Processing batch #${stats.batchesProcessed}: ${posts.length} posts from r/${SUBREDDIT}`);
      console.log(`📦 Processing batch #${stats.batchesProcessed}: ${posts.length} posts...`);
      
      try {
        // Get post IDs
        const postIds = posts.map(post => post.id);
        
        // Fetch existing data from database to detect changes
        const existingPosts = await dbHandler.getExistingPosts(postIds);
        
        // Separate posts into new
        const postChangeResult = await changeDetector.detectPostChanges(posts, existingPosts);
        const newPosts = postChangeResult.new;
        
        // Only insert new posts, skip updates
        if (newPosts.length > 0) {
          try {
            logger.info(`Inserting ${newPosts.length} new posts`);
            
            // Insert posts
            const insertedPostIds = await dbHandler.insertPosts(newPosts);
            stats.newPostsInserted += insertedPostIds.length;
            
            logger.info(`Successfully inserted ${insertedPostIds.length} new posts`);
            
            // Pause after insertion
            await sleep(5000);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error inserting new posts: ${errorMsg}`);
            console.error(`❌ Error in batch #${stats.batchesProcessed}: ${errorMsg}`);
            
            // Longer pause after error to let system recover
            await sleep(ERROR_PAUSE);
          }
        } else {
          logger.info(`No new posts to insert in this batch`);
        }
        
        // Skip comments entirely
        if (comments.length > 0) {
          logger.info(`Skipping ${comments.length} comments as this script only processes posts`);
        }
        
        // Add pause after entire batch
        logger.debug(`Pausing for ${BATCH_PAUSE/1000} seconds after batch...`);
        await sleep(BATCH_PAUSE);
        
      } catch (error) {
        stats.errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing batch: ${errorMessage}`);
        console.error(`❌ Error in batch #${stats.batchesProcessed}: ${errorMessage}`);
        
        // Longer pause after batch error
        await sleep(ERROR_PAUSE);
      }
    };

    // Process the quarter with retries
    let retryCount = 0;
    
    while (retryCount <= MAX_RETRIES) {
      try {
        logger.info(`Processing quarter: ${QUARTER.name} (sort: ${QUARTER.sort}, time: ${QUARTER.time})`);
        console.log(`\n🔄 Processing quarter: ${QUARTER.name} (sort: ${QUARTER.sort}, time: ${QUARTER.time})`);
        
        // Stream data from Reddit
        await fetcher.streamSubreddit(
          SUBREDDIT,
          { processBatch },
          {
            sort: QUARTER.sort,
            time: QUARTER.time as any,
            limit: 100,
            batchSize: BATCH_SIZE,
            maxRetries: 5,
            retryDelay: 30000, // 30 seconds
            maxAgeHours: 24 * 365 * 3 // Up to 3 years
          }
        );
        
        // Quarter processed successfully
        logger.info(`Quarter ${QUARTER.name} completed successfully`);
        console.log(`\n✅ Completed processing quarter ${QUARTER.name}`);
        break;
        
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errorCount++;
        
        if (retryCount <= MAX_RETRIES) {
          const waitTime = NETWORK_RETRY_DELAY * Math.pow(2, retryCount - 1);
          logger.error(`Error processing quarter ${QUARTER.name} (attempt ${retryCount}/${MAX_RETRIES}): ${errorMessage}`);
          console.error(`\n❌ Error in quarter ${QUARTER.name} (attempt ${retryCount}/${MAX_RETRIES}): ${errorMessage}`);
          console.log(`Waiting ${waitTime / 1000} seconds before retrying...`);
          
          // Wait longer between retries
          await sleep(waitTime);
          
          logger.info(`Retrying quarter ${QUARTER.name} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
          console.log(`\n🔄 Retrying quarter ${QUARTER.name}...`);
        } else {
          logger.error(`Failed to process quarter ${QUARTER.name} after ${MAX_RETRIES} attempts: ${errorMessage}`);
          console.error(`\n❌ FAILED: Quarter ${QUARTER.name} could not be processed after ${MAX_RETRIES} attempts.`);
          throw new Error(`Maximum retries reached for quarter ${QUARTER.name}: ${errorMessage}`);
        }
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${errorMessage}`);
    console.error(`\n\n❌ FATAL ERROR: ${errorMessage}`);
  } finally {
    printProgressSummary(true);
  }
}

// Run the script
fetchPostsOnly().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 