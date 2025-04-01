/**
 * AskSF Complete Data Fetcher
 * 
 * This script fetches BOTH posts and comments from r/AskSF for ALL quarters
 * with extreme resilience against network issues and database constraints.
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
const logger = new Logger('AskSFComplete');

// Configuration
const SUBREDDIT = 'AskSF';
const MAX_RETRIES = 10;
const BATCH_SIZE = 10; // Smaller batch size for better reliability
const NETWORK_RETRY_DELAY = 30000; // 30 seconds
const BATCH_PAUSE = 15000; // 15 seconds between batches
const POST_COMMENT_PAUSE = 8000; // 8 seconds between operations
const ERROR_PAUSE = 60000; // 1 minute after errors

// Define all quarters to fetch
const QUARTERS = [
  { name: 'New Posts', sort: 'new' as const, time: 'all' as const },
  { name: 'Top All Time', sort: 'top' as const, time: 'all' as const },
  { name: 'Top Year', sort: 'top' as const, time: 'year' as const },
  { name: 'Top Month', sort: 'top' as const, time: 'month' as const },
  { name: 'Hot Posts', sort: 'hot' as const, time: 'all' as const }
];

// Global stats to track progress
const stats = {
  startTime: new Date(),
  quarterNum: 0,
  quarterName: '',
  batchesProcessed: 0,
  postsProcessed: 0,
  commentsProcessed: 0,
  newPostsInserted: 0,
  newCommentsInserted: 0,
  updatedPosts: 0,
  updatedComments: 0,
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
function printProgressSummary(isQuarterComplete = false): void {
  const elapsedTime = formatTimeElapsed(stats.startTime);
  
  console.log('\n--- Progress Summary ---');
  console.log(`Time elapsed: ${elapsedTime}`);
  console.log(`Current quarter: ${stats.quarterNum + 1}/${QUARTERS.length} (${stats.quarterName})`);
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
  processor: { processBatch: (posts: RedditPost[], comments: RedditComment[]) => Promise<void> },
  quarter: { 
    name: string;
    sort: 'new' | 'hot' | 'top';
    time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' 
  },
  maxRetries: number = MAX_RETRIES
): Promise<void> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      logger.info(`Processing quarter: ${quarter.name} (sort: ${quarter.sort}, time: ${quarter.time})`);
      console.log(`\n🔄 Processing quarter: ${quarter.name} (sort: ${quarter.sort}, time: ${quarter.time})`);
      
      // Stream data from Reddit with aggressive retries
      await fetcher.streamSubreddit(
        SUBREDDIT,
        processor,
        {
          sort: quarter.sort,
          time: quarter.time,
          limit: 100,
          batchSize: BATCH_SIZE,
          // More aggressive retry settings
          maxRetries: 10,
          retryDelay: 60000, // 1 minute
          maxAgeHours: 24 * 365 * 3 // Up to 3 years
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
async function fetchAllQuarters(): Promise<void> {
  logger.info('Starting comprehensive AskSF data fetch for all quarters');
  console.log('🚀 Starting comprehensive AskSF data fetch for all quarters');
  
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
            
            // Process comments in smaller batches to avoid overwhelming Supabase
            const commentBatchSize = Math.min(10, existingCommentsForUpdate.length);
            let updatedCount = 0;
            
            for (let i = 0; i < existingCommentsForUpdate.length; i += commentBatchSize) {
              const commentBatch = existingCommentsForUpdate.slice(i, i + commentBatchSize);
              try {
                // For each comment in the batch, manually remove search_vector
                const commentsWithoutSearchVector = commentBatch.map(comment => {
                  const { search_vector, ...rest } = comment;
                  return { ...rest, last_checked: new Date() };
                });
                
                // Update comments
                const updatedIds = await dbHandler.updateComments(commentsWithoutSearchVector);
                updatedCount += updatedIds.length;
                
                // Small pause between sub-batches
                if (i + commentBatchSize < existingCommentsForUpdate.length) {
                  await sleep(1000);
                }
              } catch (batchError) {
                logger.error(`Error updating comment sub-batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
                // Continue with next sub-batch
              }
            }
            
            stats.updatedComments += updatedCount;
            logger.info(`Successfully updated ${updatedCount} existing comments`);
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error updating comments: ${errorMsg}`);
            console.error(`❌ Error updating comments in batch #${stats.batchesProcessed}: ${errorMsg}`);
          }
        }
        
        // Add a pause after each batch to prevent network congestion
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

    // Process each quarter one by one
    for (let i = 0; i < QUARTERS.length; i++) {
      const quarter = QUARTERS[i];
      stats.quarterNum = i;
      stats.quarterName = quarter.name;
      
      // Reset batch counters for this quarter
      stats.batchesProcessed = 0;
      
      try {
        console.log(`\n\n======= QUARTER ${i + 1}/${QUARTERS.length}: ${quarter.name} =======\n`);
        
        // Create a processor object with processBatch method
        const processor = { processBatch };
        
        // Process the quarter with enhanced retry logic
        await processQuarterWithRetry(fetcher, processor, quarter, MAX_RETRIES);
        
        logger.info(`Completed processing quarter ${quarter.name}`);
        console.log(`\n✅ Completed processing quarter ${quarter.name}`);
        
        // Print quarter summary
        printProgressSummary(true);
        
        // Add longer pause between quarters
        if (i < QUARTERS.length - 1) {
          const pauseTime = 60000; // 1 minute between quarters
          logger.info(`Pausing for ${pauseTime/1000} seconds before next quarter...`);
          console.log(`\nPausing for ${pauseTime/1000} seconds before next quarter...`);
          await sleep(pauseTime);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to process quarter ${quarter.name}: ${errorMessage}`);
        console.error(`\n❌ QUARTER FAILED: ${quarter.name} - ${errorMessage}`);
        
        // Continue with next quarter instead of terminating the whole process
        console.log(`\nMoving on to next quarter...`);
        await sleep(30000); // 30 second pause before next quarter
      }
    }
    
    logger.info(`Completed processing all quarters`);
    console.log(`\n\n✅ COMPLETED ALL QUARTERS - INGESTION COMPLETE ✅`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${errorMessage}`);
    console.error(`\n\n❌ FATAL ERROR: ${errorMessage}`);
  } finally {
    const finalElapsedTime = formatTimeElapsed(stats.startTime);
    console.log('\n===== FINAL STATISTICS =====');
    console.log(`Total time elapsed: ${finalElapsedTime}`);
    console.log(`Total posts processed: ${stats.postsProcessed}`);
    console.log(`Total comments processed: ${stats.commentsProcessed}`);
    console.log(`Total new posts inserted: ${stats.newPostsInserted}`);
    console.log(`Total new comments inserted: ${stats.newCommentsInserted}`);
    console.log(`Total posts updated: ${stats.updatedPosts}`);
    console.log(`Total comments updated: ${stats.updatedComments}`);
    console.log(`Total error count: ${stats.errorCount}`);
    console.log(`Total API requests: ${stats.apiRequests}`);
    console.log('===========================');
  }
}

// Run the script
fetchAllQuarters().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 