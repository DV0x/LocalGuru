/**
 * Resilient AskSF Quarter Fetching Script
 * 
 * This script fetches data from the AskSF subreddit for a specific quarter
 * with extreme resilience against network issues and database constraints.
 * 
 * Features:
 * - Aggressive retry mechanisms for network failures
 * - Proper foreign key constraint handling
 * - Extensive pauses between operations
 * - Enhanced error logging and recovery
 */

import dotenv from 'dotenv';
import { Logger } from '../utils/logger';
import { DBHandler } from '../db/db-handler';
import { RedditFetcher, RedditPost, RedditComment } from '../fetchers';
import { ChangeDetector } from '../processors';
import { config } from '../config';
import path from 'path';

// Load environment variables
dotenv.config();

// Create logger
const logger = new Logger('AskSFResilient');

// Configuration
const SUBREDDIT = 'AskSF';
const MAX_RETRIES = 15;
const BATCH_SIZE = 20;
const NETWORK_RETRY_DELAY = 30000; // 30 seconds
const BATCH_PAUSE = 15000; // 15 seconds
const POST_COMMENT_PAUSE = 10000; // 10 seconds
const ERROR_PAUSE = 60000; // 1 minute

// Define quarters to fetch - covering only the last year in detail
const QUARTERS = [
  { name: 'New Posts (Last Year)', sort: 'new', limit: 2000, fetchAllTime: false, maxAgeHours: 24 * 365 },
  { name: 'Top Year', sort: 'top', limit: 2000, fetchAllTime: false, maxAgeHours: 24 * 365 },
  { name: 'Top Month (Current)', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 30 },
  { name: 'Top Month (Last)', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 60 },
  { name: 'Top Month (2 Months Ago)', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 90 },
  { name: 'Top Month (3 Months Ago)', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 120 },
  { name: 'Top Month (6 Months Ago)', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 180 },
  { name: 'Top Month (9 Months Ago)', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 270 },
  { name: 'Hot Posts (Current)', sort: 'hot', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 30 }
] as const;

// Global stats to track progress
const stats = {
  startTime: new Date(),
  batchesProcessed: 0,
  postsProcessed: 0,
  commentsProcessed: 0,
  newPostsInserted: 0,
  newCommentsInserted: 0,
  updatedPosts: 0,
  updatedComments: 0,
  errorCount: 0,
  apiRequests: 0,
  lastApiRequestTime: new Date()
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
function printProgressSummary(isQuarterComplete = false): void {
  const elapsedTime = formatTimeElapsed(stats.startTime);
  
  console.log('\n--- Progress Summary ---');
  console.log(`Time elapsed: ${elapsedTime}`);
  console.log(`Batches processed: ${stats.batchesProcessed}`);
  console.log(`Posts processed: ${stats.postsProcessed}`);
  console.log(`Comments processed: ${stats.commentsProcessed}`);
  console.log(`New posts inserted: ${stats.newPostsInserted}`);
  console.log(`New comments inserted: ${stats.newCommentsInserted}`);
  console.log(`Posts updated: ${stats.updatedPosts}`);
  console.log(`Comments updated: ${stats.updatedComments}`);
  console.log(`Error count: ${stats.errorCount}`);
  console.log(`API requests: ${stats.apiRequests}`);
  console.log(isQuarterComplete ? '--- Quarter Complete ---\n' : '--- In Progress ---\n');
}

// Track API request with rate limiting
function trackApiRequest(): void {
  const now = new Date();
  stats.apiRequests++;
  stats.lastApiRequestTime = now;
  
  // Log every 10 API requests
  if (stats.apiRequests % 10 === 0) {
    logger.info(`API requests made: ${stats.apiRequests}`);
  }
}

// Sleep utility
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Process a quarter with retries
async function processQuarterWithRetry(
  fetcher: RedditFetcher,
  processBatchFn: (posts: RedditPost[], comments: RedditComment[]) => Promise<void>,
  quarter: { 
    name: string;
    sort: 'new' | 'hot' | 'top';
    limit: number;
    fetchAllTime: boolean;
    maxAgeHours: number;
  },
  maxRetries: number = MAX_RETRIES
): Promise<void> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      logger.info(`Processing quarter: ${quarter.name} (sort: ${quarter.sort}, limit: ${quarter.limit}, fetchAllTime: ${quarter.fetchAllTime}, maxAgeHours: ${quarter.maxAgeHours})`);
      console.log(`\n Processing quarter: ${quarter.name} (sort: ${quarter.sort}, limit: ${quarter.limit}, fetchAllTime: ${quarter.fetchAllTime}, maxAgeHours: ${quarter.maxAgeHours})`);
      
      // Stream data from Reddit with aggressive retries
      await fetcher.streamSubreddit(
        SUBREDDIT,
        { processBatch: processBatchFn },
        {
          sort: quarter.sort,
          maxPosts: quarter.limit,
          fetchAllTime: quarter.fetchAllTime,
          batchSize: BATCH_SIZE,
          useCheckpoints: true
        }
      );
      
      // Quarter processed successfully
      logger.info(`Quarter ${quarter.name} completed successfully`);
      return;
      
    } catch (error) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats.errorCount++;
      
      if (retryCount <= maxRetries) {
        const waitTime = NETWORK_RETRY_DELAY * Math.pow(2, retryCount - 1);
        logger.error(`Error processing quarter ${quarter.name} (attempt ${retryCount}/${maxRetries}): ${errorMessage}`);
        console.error(`\n❌ Error in quarter ${quarter.name} (attempt ${retryCount}/${maxRetries}): ${errorMessage}`);
        console.log(`Waiting ${waitTime / 1000} seconds before retrying...`);
        
        // Wait longer between retries
        await sleep(waitTime);
        
        logger.info(`Retrying quarter ${quarter.name} (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        console.log(`\n🔄 Retrying quarter ${quarter.name}...`);
      } else {
        logger.error(`Failed to process quarter ${quarter.name} after ${maxRetries} attempts: ${errorMessage}`);
        console.error(`\n❌ FAILED: Quarter ${quarter.name} could not be processed after ${maxRetries} attempts.`);
        throw new Error(`Maximum retries reached for quarter ${quarter.name}: ${errorMessage}`);
      }
    }
  }
}

// Main function
async function fetchResilient(): Promise<void> {
  logger.info('Starting resilient AskSF data fetch');
  console.log('🚀 Starting resilient AskSF data fetch');
  
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
      retryAttempts: 8,
      disableTriggers: config.database.disableTriggers || false
    });
    
    // Create RedditFetcher with very lenient rate limiting
    const fetcher = new RedditFetcher({
      userAgent: 'LocalGuru/1.0',
      requestDelay: 5000, // 5 seconds between requests
      checkpointDir: path.join(process.cwd(), 'checkpoints', SUBREDDIT)
    });
    
    // Create change detector
    const changeDetector = new ChangeDetector({
      checksumFields: config.changeDetection.checksumFields || ['title', 'content', 'score'],
      ignoreFields: config.changeDetection.ignoreFields || ['last_updated'],
      forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays || 7
    });
    
    // Define batch processor function
    const processBatch = async (posts: RedditPost[], comments: RedditComment[]): Promise<void> => {
      // Increment batch counter
      stats.batchesProcessed++;
      stats.postsProcessed += posts.length;
      stats.commentsProcessed += comments.length;
      
      // Increment API counter for each batch
      trackApiRequest();
      
      logger.info(`Processing batch #${stats.batchesProcessed}: ${posts.length} posts and ${comments.length} comments from r/${SUBREDDIT}`);
      console.log(`📦 Processing batch #${stats.batchesProcessed}: ${posts.length} posts, ${comments.length} comments...`);
      
      try {
        // Get post and comment IDs
        const postIds = posts.map(post => post.id);
        const commentIds = comments.map(comment => comment.id);
        
        // Fetch existing data from database to detect changes
        const existingPosts = await dbHandler.getExistingPosts(postIds);
        const existingComments = await dbHandler.getExistingComments(commentIds);
        
        // Track post IDs that exist in the database (for foreign key integrity)
        const knownPostIds = new Set<string>([...existingPosts.keys()]);
        
        // Separate posts and comments into new and existing
        const postChangeResult = await changeDetector.detectPostChanges(posts, existingPosts);
        const newPosts = postChangeResult.new;
        const existingPostsForUpdate = postChangeResult.updated;
        
        const commentChangeResult = await changeDetector.detectCommentChanges(comments, existingComments);
        const newComments = commentChangeResult.new;
        const existingCommentsForUpdate = commentChangeResult.updated;
        
        // ---- HANDLE POSTS ----
        
        // Insert new posts
        if (newPosts.length > 0) {
          try {
            logger.info(`Inserting ${newPosts.length} new posts`);
            
            // Insert posts and get IDs of successfully inserted posts
            const insertedPostIds = await dbHandler.insertPosts(newPosts);
            stats.newPostsInserted += insertedPostIds.length;
            
            // Add new post IDs to our tracking set
            insertedPostIds.forEach(id => knownPostIds.add(id));
            
            logger.info(`Successfully inserted ${insertedPostIds.length} new posts`);
            
            // Pause after insertion
            await sleep(POST_COMMENT_PAUSE);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error inserting new posts: ${errorMsg}`);
            console.error(`❌ Error in batch #${stats.batchesProcessed}: ${errorMsg}`);
            
            // Longer pause after error to let system recover
            await sleep(ERROR_PAUSE / 2);
          }
        }
        
        // Update existing posts
        if (existingPostsForUpdate.length > 0) {
          try {
            logger.info(`Updating ${existingPostsForUpdate.length} existing posts`);
            const updatedPostIds = await dbHandler.updatePosts(existingPostsForUpdate);
            stats.updatedPosts += updatedPostIds.length;
            logger.info(`Successfully updated ${updatedPostIds.length} existing posts`);
            
            // Pause after updates
            await sleep(POST_COMMENT_PAUSE / 2);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error updating posts: ${errorMsg}`);
            console.error(`❌ Error updating posts in batch #${stats.batchesProcessed}: ${errorMsg}`);
            
            // Pause after error
            await sleep(ERROR_PAUSE / 3);
          }
        }
        
        // ---- HANDLE COMMENTS ----
        
        // Filter comments to only include those with posts that exist in the database
        const validNewComments = newComments.filter(comment => knownPostIds.has(comment.post_id));
        
        if (validNewComments.length < newComments.length) {
          const skippedCount = newComments.length - validNewComments.length;
          logger.warn(`Skipping ${skippedCount} comments because their parent posts don't exist in the database`);
        }
        
        // Insert new comments (only those with valid post_ids)
        if (validNewComments.length > 0) {
          try {
            logger.info(`Inserting ${validNewComments.length} new comments`);
            const insertedCommentIds = await dbHandler.insertComments(validNewComments);
            stats.newCommentsInserted += insertedCommentIds.length;
            logger.info(`Successfully inserted ${insertedCommentIds.length} new comments`);
            
            // Pause after insertion
            await sleep(POST_COMMENT_PAUSE / 2);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error inserting comments: ${errorMsg}`);
            console.error(`❌ Error inserting comments in batch #${stats.batchesProcessed}: ${errorMsg}`);
            
            // Pause after error
            await sleep(ERROR_PAUSE / 3);
          }
        }
        
        // Update existing comments
        if (existingCommentsForUpdate.length > 0) {
          try {
            logger.info(`Updating ${existingCommentsForUpdate.length} existing comments`);
            const updatedCommentIds = await dbHandler.updateComments(existingCommentsForUpdate);
            stats.updatedComments += updatedCommentIds.length;
            logger.info(`Successfully updated ${updatedCommentIds.length} existing comments`);
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error updating comments: ${errorMsg}`);
            console.error(`❌ Error updating comments in batch #${stats.batchesProcessed}: ${errorMsg}`);
          }
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

    // Choose one quarter to process (default: new posts - most important)
    const quarterIndex = 0; // Change this to process different quarters
    const selectedQuarter = QUARTERS[quarterIndex];
    
    // Process the selected quarter with enhanced retry logic
    await processQuarterWithRetry(fetcher, processBatch, selectedQuarter, MAX_RETRIES);
    
    logger.info(`Completed processing quarter ${selectedQuarter.name}`);
    console.log(`\n✅ Completed processing quarter ${selectedQuarter.name}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${errorMessage}`);
    console.error(`\n\n❌ FATAL ERROR: ${errorMessage}`);
  } finally {
    printProgressSummary(true);
  }
}

// Run the script
fetchResilient().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 