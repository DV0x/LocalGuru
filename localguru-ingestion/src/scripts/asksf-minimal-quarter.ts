import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { RedditFetcher, RedditPost, RedditComment } from '../fetchers';
import { ChangeDetector } from '../processors';
import { DBHandler } from '../db/db-handler';
import { config } from '../config';

// Load environment variables
dotenv.config();

// Constants
const SUBREDDIT = 'AskSF';
const BATCH_SIZE = 10; // Reduced from 25 to 10
const MAX_POSTS_PER_QUARTER = 500; // Reduced from 2500 to 500

// Define quarters
const QUARTERS = [
  { name: 'New Posts', sort: 'new' as const, time: 'all' as const },
  { name: 'Top (All Time)', sort: 'top' as const, time: 'all' as const },
  { name: 'Top (Year)', sort: 'top' as const, time: 'year' as const },
  { name: 'Top (Month)', sort: 'top' as const, time: 'month' as const },
  { name: 'Top (Week)', sort: 'top' as const, time: 'week' as const },
  { name: 'Hot Posts', sort: 'hot' as const, time: 'all' as const },
  { name: 'Top (Day)', sort: 'top' as const, time: 'day' as const },
  { name: 'Rising Posts', sort: 'hot' as const, time: 'all' as const }
];

// Initialize logger
const logger = new Logger('AskSFMinimal');

// Global stats tracking
const stats = {
  startTime: new Date(),
  totalPostsFetched: 0,
  totalCommentsFetched: 0,
  newPostsInserted: 0,
  updatedPosts: 0,
  newCommentsInserted: 0,
  updatedComments: 0,
  batchesProcessed: 0,
  quartersCompleted: 0,
  apiRequestsMade: 0,
  errorCount: 0,
  retryCount: 0
};

/**
 * Format time elapsed in a human-readable format
 */
function formatTimeElapsed(startTime: Date): string {
  const elapsed = new Date().getTime() - startTime.getTime();
  const seconds = Math.floor((elapsed / 1000) % 60);
  const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
  const hours = Math.floor((elapsed / (1000 * 60 * 60)));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Print a summary of the current ingestion progress
 */
function printProgressSummary(isQuarterComplete = false): void {
  const timeElapsed = formatTimeElapsed(stats.startTime);
  const avgPostsPerMinute = stats.totalPostsFetched / (((new Date().getTime() - stats.startTime.getTime()) / 1000) / 60);
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 INGESTION PROGRESS SUMMARY ${isQuarterComplete ? '- QUARTER COMPLETED' : ''}`);
  console.log('='.repeat(80));
  console.log(`🕒 Time Elapsed: ${timeElapsed}`);
  console.log(`🔄 Quarter: ${stats.quartersCompleted} of 1`);
  console.log(`📦 Batches Processed: ${stats.batchesProcessed}`);
  console.log(`🌐 API Requests Made: ${stats.apiRequestsMade}`);
  console.log(`🔄 Retry Count: ${stats.retryCount}`);
  console.log('='.repeat(40));
  console.log(`📥 FETCHED DATA:`);
  console.log(`   Posts: ${stats.totalPostsFetched}`);
  console.log(`   Comments: ${stats.totalCommentsFetched}`);
  console.log(`   Average Rate: ${avgPostsPerMinute.toFixed(2)} posts/minute`);
  console.log('='.repeat(40));
  console.log(`💾 DATABASE OPERATIONS:`);
  console.log(`   New Posts Inserted: ${stats.newPostsInserted}`);
  console.log(`   Updated Posts: ${stats.updatedPosts}`);
  console.log(`   New Comments Inserted: ${stats.newCommentsInserted}`);
  console.log(`   Updated Comments: ${stats.updatedComments}`);
  console.log('='.repeat(40));
  console.log(`❌ Error Count: ${stats.errorCount}`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Update API request counter (called before each Reddit API request)
 */
function trackApiRequest(): void {
  stats.apiRequestsMade++;
  // Print a simple progress indicator every 5 requests
  if (stats.apiRequestsMade % 5 === 0) {
    process.stdout.write(`⚡ API Requests: ${stats.apiRequestsMade}, Posts: ${stats.totalPostsFetched}, Time: ${formatTimeElapsed(stats.startTime)}\r`);
  }
}

// Custom batch processor interface
interface BatchProcessor {
  processBatch(posts: RedditPost[], comments: RedditComment[]): Promise<void>;
}

/**
 * Process a specific quarter of data with enhanced error handling
 */
async function processQuarterWithRetry(
  fetcher: RedditFetcher,
  batchProcessor: BatchProcessor,
  quarter: { 
    name: string;
    sort: 'new' | 'hot' | 'top';
    time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' 
  },
  maxRetries: number = 3
): Promise<void> {
  let retryCount = 0;
  let success = false;
  
  while (!success && retryCount <= maxRetries) {
    try {
      if (retryCount > 0) {
        logger.warn(`Retry #${retryCount} for quarter ${quarter.name}`);
        // Wait longer between retries
        const waitTime = Math.pow(2, retryCount) * 30000; // 30s, 60s, 120s, etc.
        logger.info(`Waiting ${waitTime/1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        stats.retryCount++;
      }
      
      logger.info(`Processing ${quarter.name} data for r/${SUBREDDIT} using ${quarter.sort} posts by ${quarter.time}`);
      console.log('\n' + '-'.repeat(60));
      console.log(`🔍 STARTING QUARTER: ${quarter.name} (${quarter.sort} by ${quarter.time})`);
      console.log('-'.repeat(60) + '\n');
      
      const quarterStartTime = new Date();
      
      // Track original API request counter to calculate requests for this quarter
      const startingApiRequests = stats.apiRequestsMade;
      
      // Stream subreddit data using batch processor with reduced parameters
      const result = await fetcher.streamSubreddit(SUBREDDIT, batchProcessor, {
        maxPosts: MAX_POSTS_PER_QUARTER,
        sort: quarter.sort,
        fetchAllTime: quarter.time === 'all',
        useCheckpoints: true,
        batchSize: BATCH_SIZE
      });
      
      // Update global stats
      stats.totalPostsFetched += result.totalPosts;
      stats.totalCommentsFetched += result.totalComments;
      stats.quartersCompleted = 1;
      
      const quarterTimeElapsed = formatTimeElapsed(quarterStartTime);
      const quarterApiRequests = stats.apiRequestsMade - startingApiRequests;
      
      logger.info(`Completed ${quarter.name}: Processed ${result.totalPosts} posts and ${result.totalComments} comments`);
      
      console.log('\n' + '-'.repeat(60));
      console.log(`✅ QUARTER COMPLETED: ${quarter.name}`);
      console.log(`   Posts Processed: ${result.totalPosts}`);
      console.log(`   Comments Processed: ${result.totalComments}`);
      console.log(`   Time Taken: ${quarterTimeElapsed}`);
      console.log(`   API Requests: ${quarterApiRequests}`);
      console.log('-'.repeat(60) + '\n');
      
      // Print full summary after quarter completion
      printProgressSummary(true);
      
      success = true;
    } catch (error) {
      retryCount++;
      stats.errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing ${quarter.name} (attempt ${retryCount}/${maxRetries + 1}): ${errorMessage}`);
      
      if (retryCount > maxRetries) {
        logger.error(`Failed to process ${quarter.name} after ${maxRetries + 1} attempts`);
        throw error;
      }
      
      // If we hit a network error, wait longer
      if (errorMessage.includes('fetch failed') || 
          errorMessage.includes('network') || 
          errorMessage.includes('429')) {
        const waitTime = Math.pow(2, retryCount) * 60000; // 1min, 2min, 4min, etc.
        logger.warn(`Network error detected, waiting ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

/**
 * Main function to fetch historical data from one quarter of AskSF subreddit
 */
async function fetchOneQuarter() {
  console.log('\n' + '*'.repeat(80));
  console.log(`🚀 STARTING MINIMAL QUARTER INGESTION FOR r/${SUBREDDIT}`);
  console.log('*'.repeat(80) + '\n');
  
  logger.info(`Starting minimal quarter data fetching for r/${SUBREDDIT}`);

  try {
    // Initialize Supabase client parameters
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }

    // Initialize database handler with more conservative settings
    const dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
      batchSize: 10, // Reduced batch size for database operations
      retryAttempts: 8, // Increased retry attempts
      disableTriggers: config.database.disableTriggers || false
    });

    // Initialize change detector
    const changeDetector = new ChangeDetector({
      checksumFields: config.changeDetection.checksumFields || ['title', 'content', 'score'],
      ignoreFields: config.changeDetection.ignoreFields || ['last_updated'],
      forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays || 7
    });

    // Initialize Reddit fetcher with custom checkpoint directory and increased delay
    const fetcher = new RedditFetcher({
      userAgent: process.env.REDDIT_USER_AGENT || 'Localguru/1.0 (AskSF Data Ingestion)',
      requestDelay: parseInt(process.env.REDDIT_REQUEST_DELAY || '5000', 10), // Increased delay
      checkpointDir: path.join(process.cwd(), 'checkpoints', SUBREDDIT)
    });
    
    // Increment API counter at the start
    trackApiRequest();

    // Create custom batch processor with enhanced error handling
    const batchProcessor: BatchProcessor = {
      async processBatch(posts: RedditPost[], comments: RedditComment[]): Promise<void> {
        if (!posts.length) return;
        
        stats.batchesProcessed++;
        
        // Increment API counter for each batch (approximation)
        trackApiRequest();
        
        logger.info(`Processing batch #${stats.batchesProcessed}: ${posts.length} posts and ${comments.length} comments from r/${SUBREDDIT}`);
        process.stdout.write(`📦 Processing batch #${stats.batchesProcessed}: ${posts.length} posts, ${comments.length} comments...\r`);
        
        try {
          // Get post and comment IDs
          const postIds = posts.map(post => post.id);
          const commentIds = comments.map(comment => comment.id);
          
          // Fetch existing data from database to detect changes
          const existingPosts = await dbHandler.getExistingPosts(postIds);
          const existingComments = await dbHandler.getExistingComments(commentIds);
          
          // Separate posts and comments into new and existing
          const postChangeResult = await changeDetector.detectPostChanges(posts, existingPosts);
          const newPosts = postChangeResult.new;
          const existingPostsForUpdate = postChangeResult.updated;
          
          const commentChangeResult = await changeDetector.detectCommentChanges(comments, existingComments);
          const newComments = commentChangeResult.new;
          const existingCommentsForUpdate = commentChangeResult.updated;
          
          // Insert new posts
          if (newPosts.length > 0) {
            try {
              logger.info(`Inserting ${newPosts.length} new posts`);
              const insertedPostIds = await dbHandler.insertPosts(newPosts);
              stats.newPostsInserted += insertedPostIds.length;
              logger.info(`Successfully inserted ${insertedPostIds.length} new posts`);
            } catch (error) {
              stats.errorCount++;
              const errorMsg = error instanceof Error ? error.message : String(error);
              logger.error(`❌ Error inserting new posts: ${errorMsg}`);
              console.error(`❌ Error in batch #${stats.batchesProcessed}: ${errorMsg}`);
              
              // Continue processing to update posts and handle comments
            }
          }
          
          // Update existing posts
          if (existingPostsForUpdate.length > 0) {
            try {
              logger.info(`Updating ${existingPostsForUpdate.length} existing posts`);
              const updatedPostIds = await dbHandler.updatePosts(existingPostsForUpdate);
              stats.updatedPosts += updatedPostIds.length;
              logger.info(`Successfully updated ${updatedPostIds.length} existing posts`);
            } catch (error) {
              stats.errorCount++;
              const errorMsg = error instanceof Error ? error.message : String(error);
              logger.error(`❌ Error updating posts: ${errorMsg}`);
              console.error(`❌ Error updating posts in batch #${stats.batchesProcessed}: ${errorMsg}`);
              
              // Continue processing to handle comments
            }
          }
          
          // Add pause between post and comment operations
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Insert new comments
          if (newComments.length > 0) {
            try {
              logger.info(`Inserting ${newComments.length} new comments`);
              const insertedCommentIds = await dbHandler.insertComments(newComments);
              stats.newCommentsInserted += insertedCommentIds.length;
              logger.info(`Successfully inserted ${insertedCommentIds.length} new comments`);
            } catch (error) {
              stats.errorCount++;
              const errorMsg = error instanceof Error ? error.message : String(error);
              logger.error(`❌ Error inserting comments: ${errorMsg}`);
              console.error(`❌ Error inserting comments in batch #${stats.batchesProcessed}: ${errorMsg}`);
              
              // Continue processing to update comments
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
          
          // Add a pause after each batch to prevent network congestion
          logger.debug(`Pausing for 5 seconds after batch...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          stats.errorCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error processing batch: ${errorMessage}`);
          console.error(`❌ Error in batch #${stats.batchesProcessed}: ${errorMessage}`);
          
          // Don't rethrow, just log and continue
        }
      }
    };

    // Choose one quarter to process (first one)
    const quarterIndex = 0; // Change this to process different quarters
    const selectedQuarter = QUARTERS[quarterIndex];
    
    // Process the selected quarter with enhanced retry logic
    await processQuarterWithRetry(fetcher, batchProcessor, selectedQuarter, 5);
    
    logger.info(`Completed processing quarter ${selectedQuarter.name}`);
    console.log(`\nCompleted processing quarter ${selectedQuarter.name}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${errorMessage}`);
    console.error(`\n\n❌ FATAL ERROR: ${errorMessage}`);
  } finally {
    printProgressSummary(true);
  }
}

// Run the script
fetchOneQuarter().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 