/**
 * Daily Reddit Update Script
 * 
 * This script is based directly on the proven asksf-resilient-fixed.ts script,
 * with only the time range modified to focus on the last 7 days.
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
const logger = new Logger('DailyRedditUpdate');

// Configuration - IDENTICAL to asksf-resilient-fixed.ts
const SUBREDDIT = 'AskSF';
const MAX_RETRIES = 15;
const BATCH_SIZE = 15; // Reduced from 20 for better reliability
const NETWORK_RETRY_DELAY = 30000; // 30 seconds
const BATCH_PAUSE = 15000; // 15 seconds
const POST_COMMENT_PAUSE = 10000; // 10 seconds
const ERROR_PAUSE = 60000; // 1 minute
const COMMENT_BATCH_SIZE = 3; // Very small batches for comments
const COMMENT_BATCH_PAUSE = 5000; // 5 seconds between comment batches
const MAX_COMMENT_RETRY_ATTEMPTS = 3; // Maximum number of retry attempts for comment batches

// Comment retry queue - IDENTICAL to asksf-resilient-fixed.ts
interface RetryQueueItem {
  comments: RedditComment[];
  attemptCount: number;
  lastAttemptTime: Date;
  quarterName: string;
}

const commentRetryQueue: RetryQueueItem[] = [];

// Define quarters to fetch - ONLY CHANGE: just the last 7 days
const QUARTERS = [
  // Recent data (last 7 days) with all sort types
  { name: 'Recent New', sort: 'new', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 7 },
  { name: 'Recent Top', sort: 'top', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 7 },
  { name: 'Recent Hot', sort: 'hot', limit: 500, fetchAllTime: false, maxAgeHours: 24 * 7 },
  { name: 'Recent Best', sort: 'best' as any, limit: 500, fetchAllTime: false, maxAgeHours: 24 * 7 },
  { name: 'Recent Controversial', sort: 'controversial' as any, limit: 500, fetchAllTime: false, maxAgeHours: 24 * 7 },
  { name: 'Recent Rising', sort: 'rising' as any, limit: 300, fetchAllTime: false, maxAgeHours: 24 * 7 }
] as const;

// Global stats to track progress - IDENTICAL to asksf-resilient-fixed.ts
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
  lastApiRequestTime: new Date(),
  currentQuarter: 0,
  currentQuarterName: '',
  totalRetryAttempts: 0,
  successfulRetries: 0
};

// Format time elapsed - IDENTICAL to asksf-resilient-fixed.ts
function formatTimeElapsed(startTime: Date): string {
  const elapsedMs = Date.now() - startTime.getTime();
  const seconds = Math.floor((elapsedMs / 1000) % 60);
  const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Create a progress bar - IDENTICAL to asksf-resilient-fixed.ts
function createProgressBar(progress: number, length: number = 30): string {
  const filledLength = Math.round(length * progress);
  const bar = '█'.repeat(filledLength) + '░'.repeat(length - filledLength);
  return `[${bar}] ${Math.round(progress * 100)}%`;
}

// Print progress summary - IDENTICAL to asksf-resilient-fixed.ts
function printProgressSummary(isQuarterComplete = false): void {
  const elapsedTime = formatTimeElapsed(stats.startTime);
  const quarterProgress = stats.currentQuarter / QUARTERS.length;
  const progressBar = createProgressBar(quarterProgress);
  
  console.log('\n══════════════════ PROGRESS SUMMARY ══════════════════');
  console.log(`⏱️  Time elapsed: ${elapsedTime}`);
  console.log(`📊 Overall progress: ${progressBar}`);
  console.log(`📌 Current quarter (${stats.currentQuarter + 1}/${QUARTERS.length}): ${stats.currentQuarterName}`);
  console.log('');
  console.log(`📦 Batches processed: ${stats.batchesProcessed}`);
  console.log(`📝 Posts processed: ${stats.postsProcessed} (New: ${stats.newPostsInserted}, Updated: ${stats.updatedPosts})`);
  console.log(`💬 Comments processed: ${stats.commentsProcessed} (New: ${stats.newCommentsInserted}, Updated: ${stats.updatedComments})`);
  console.log(`❌ Error count: ${stats.errorCount}`);
  console.log(`🔄 API requests: ${stats.apiRequests}`);
  console.log('');
  console.log(`📋 Retry queue: ${commentRetryQueue.length} batches pending`);
  console.log(`🔁 Retry attempts: ${stats.totalRetryAttempts} (Successful: ${stats.successfulRetries})`);
  console.log('═════════════════════════════════════════════════════');
  
  if (isQuarterComplete) {
    console.log(`\n✅ Quarter "${stats.currentQuarterName}" Complete!`);
  }
}

// Track API request with rate limiting - IDENTICAL to asksf-resilient-fixed.ts
function trackApiRequest(): void {
  const now = new Date();
  stats.apiRequests++;
  stats.lastApiRequestTime = now;
  
  // Log every 10 API requests
  if (stats.apiRequests % 10 === 0) {
    logger.info(`API requests made: ${stats.apiRequests}`);
  }
}

// Sleep utility - IDENTICAL to asksf-resilient-fixed.ts
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add failed comment batch to retry queue - IDENTICAL to asksf-resilient-fixed.ts
function addToRetryQueue(comments: RedditComment[], quarterName: string): void {
  commentRetryQueue.push({
    comments,
    attemptCount: 1,
    lastAttemptTime: new Date(),
    quarterName
  });
  
  logger.info(`Added ${comments.length} comments to retry queue (Total queue size: ${commentRetryQueue.length})`);
  console.log(`⏳ Queued ${comments.length} comments for retry (Total: ${commentRetryQueue.length})`);
}

// Process the retry queue - IDENTICAL to asksf-resilient-fixed.ts
async function processRetryQueue(dbHandler: DBHandler): Promise<void> {
  if (commentRetryQueue.length === 0) {
    return;
  }
  
  console.log(`\n🔄 Processing comment retry queue (${commentRetryQueue.length} batches)...`);
  logger.info(`Processing comment retry queue with ${commentRetryQueue.length} batches`);
  
  // Sort by attempt count (try lowest counts first) and then by time (oldest first)
  commentRetryQueue.sort((a, b) => {
    if (a.attemptCount !== b.attemptCount) {
      return a.attemptCount - b.attemptCount;
    }
    return a.lastAttemptTime.getTime() - b.lastAttemptTime.getTime();
  });
  
  // Process up to 5 batches from the queue
  const batchesToProcess = Math.min(5, commentRetryQueue.length);
  let successCount = 0;
  
  for (let i = 0; i < batchesToProcess; i++) {
    const item = commentRetryQueue.shift();
    if (!item) continue;
    
    // Skip if max retries reached
    if (item.attemptCount >= MAX_COMMENT_RETRY_ATTEMPTS) {
      logger.warn(`Discarding comment batch from "${item.quarterName}" after ${item.attemptCount} failed attempts`);
      console.log(`⏭️  Skipping comment batch from "${item.quarterName}" (exceeded ${MAX_COMMENT_RETRY_ATTEMPTS} attempts)`);
      continue;
    }
    
    console.log(`🔄 Retry attempt ${item.attemptCount + 1}/${MAX_COMMENT_RETRY_ATTEMPTS} for ${item.comments.length} comments from "${item.quarterName}"`);
    stats.totalRetryAttempts++;
    
    try {
      // Micro-batch the retried comments
      let retryInsertedCount = 0;
      const microBatchSize = Math.min(2, item.comments.length); // Even smaller batches for retries
      
      for (let j = 0; j < item.comments.length; j += microBatchSize) {
        const commentBatch = item.comments.slice(j, j + microBatchSize);
        
        try {
          const insertedIds = await dbHandler.insertComments(commentBatch);
          retryInsertedCount += insertedIds.length;
          stats.newCommentsInserted += insertedIds.length;
          
          // Extra long pause between retry micro-batches
          await sleep(COMMENT_BATCH_PAUSE * 2);
        } catch (microError) {
          logger.error(`Failed micro-batch during retry: ${microError instanceof Error ? microError.message : String(microError)}`);
          // Continue with next micro-batch
        }
      }
      
      if (retryInsertedCount > 0) {
        successCount++;
        stats.successfulRetries++;
        logger.info(`Successfully inserted ${retryInsertedCount}/${item.comments.length} comments during retry`);
        console.log(`✅ Retry successful: inserted ${retryInsertedCount}/${item.comments.length} comments`);
      } else {
        // If nothing inserted, re-queue with higher attempt count
        commentRetryQueue.push({
          ...item,
          attemptCount: item.attemptCount + 1,
          lastAttemptTime: new Date()
        });
        logger.warn(`Retry failed, re-queued with attempt count ${item.attemptCount + 1}`);
        console.log(`⚠️  Retry unsuccessful, re-queuing (attempt ${item.attemptCount + 1}/${MAX_COMMENT_RETRY_ATTEMPTS})`);
      }
      
      // Pause between retry batches
      await sleep(COMMENT_BATCH_PAUSE * 3);
      
    } catch (error) {
      // If the entire attempt fails, re-queue with higher attempt count
      commentRetryQueue.push({
        ...item,
        attemptCount: item.attemptCount + 1,
        lastAttemptTime: new Date()
      });
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error during retry attempt: ${errorMsg}`);
      console.log(`❌ Error during retry: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`);
      
      // Pause a bit longer after errors
      await sleep(ERROR_PAUSE / 2);
    }
  }
  
  console.log(`✓ Completed processing retry queue: ${successCount}/${batchesToProcess} batches successful, ${commentRetryQueue.length} remaining`);
  logger.info(`Completed retry queue processing: ${successCount}/${batchesToProcess} batches successful, ${commentRetryQueue.length} remaining`);
}

// Process a quarter with retries - IDENTICAL to asksf-resilient-fixed.ts
async function processQuarterWithRetry(
  fetcher: RedditFetcher,
  processBatchFn: (posts: RedditPost[], comments: RedditComment[]) => Promise<void>,
  quarter: { 
    name: string;
    sort: 'new' | 'hot' | 'top' | 'best' | 'controversial' | 'rising';
    limit: number;
    fetchAllTime: boolean;
    maxAgeHours: number;
    minAgeHours?: number;
  },
  maxRetries: number = MAX_RETRIES
): Promise<void> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      logger.info(`Processing quarter: ${quarter.name} (sort: ${quarter.sort}, limit: ${quarter.limit}, fetchAllTime: ${quarter.fetchAllTime}, maxAgeHours: ${quarter.maxAgeHours})`);
      console.log(`\n🔄 Processing quarter: ${quarter.name}`);
      console.log(`   Sort: ${quarter.sort}, Limit: ${quarter.limit}, Max Age: ${Math.round(quarter.maxAgeHours/24)} days`);
      
      // Stream data from Reddit with aggressive retries
      await fetcher.streamSubreddit(
        SUBREDDIT,
        { processBatch: processBatchFn },
        {
          sort: quarter.sort as any, // Use type assertion to handle additional sort types
          maxPosts: quarter.limit,
          fetchAllTime: quarter.fetchAllTime,
          batchSize: BATCH_SIZE,
          useCheckpoints: true,
          maxAgeHours: quarter.maxAgeHours,
          minAgeHours: quarter.minAgeHours
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
        console.log(`⏳ Waiting ${waitTime / 1000} seconds before retrying...`);
        
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

// Main function - IDENTICAL to asksf-resilient-fixed.ts except for the message
async function fetchDailyReddit(): Promise<void> {
  logger.info('Starting daily Reddit data fetch (last 7 days only)');
  console.log('\n🚀 STARTING DAILY REDDIT UPDATE (LAST 7 DAYS)');
  console.log('═════════════════════════════════════════════════════');
  console.log(`📊 Processing ${QUARTERS.length} quarters of Reddit data from r/${SUBREDDIT} (last 7 days)`);
  console.log('═════════════════════════════════════════════════════\n');
  
  try {
    // Initialize Supabase client parameters
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }

    // Create required objects - IDENTICAL to asksf-resilient-fixed.ts
    const dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
      batchSize: BATCH_SIZE,
      retryAttempts: 8,
      disableTriggers: config.database.disableTriggers || false
    });
    
    // Create RedditFetcher with very lenient rate limiting - IDENTICAL to asksf-resilient-fixed.ts
    const fetcher = new RedditFetcher({
      userAgent: 'LocalGuru/1.0',
      requestDelay: 5000, // 5 seconds between requests
      checkpointDir: path.join(process.cwd(), 'checkpoints', SUBREDDIT)
    });
    
    // Create change detector - IDENTICAL to asksf-resilient-fixed.ts
    const changeDetector = new ChangeDetector({
      checksumFields: config.changeDetection.checksumFields || ['title', 'content', 'score'],
      ignoreFields: config.changeDetection.ignoreFields || ['last_updated'],
      forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays || 7
    });
    
    // Define batch processor function - IDENTICAL to asksf-resilient-fixed.ts
    const processBatch = async (posts: RedditPost[], comments: RedditComment[]): Promise<void> => {
      // Increment batch counter
      stats.batchesProcessed++;
      stats.postsProcessed += posts.length;
      stats.commentsProcessed += comments.length;
      
      // Increment API counter for each batch
      trackApiRequest();
      
      logger.info(`Processing batch #${stats.batchesProcessed}: ${posts.length} posts and ${comments.length} comments from r/${SUBREDDIT}`);
      console.log(`\n📦 Processing batch #${stats.batchesProcessed}: ${posts.length} posts, ${comments.length} comments...`);
      
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
            console.log(`📄 Inserting ${newPosts.length} new posts...`);
            
            // Insert posts and get IDs of successfully inserted posts
            const insertedPostIds = await dbHandler.insertPosts(newPosts);
            stats.newPostsInserted += insertedPostIds.length;
            
            // Add new post IDs to our tracking set
            insertedPostIds.forEach((id: string) => knownPostIds.add(id));
            
            logger.info(`Successfully inserted ${insertedPostIds.length} new posts`);
            console.log(`✅ Successfully inserted ${insertedPostIds.length}/${newPosts.length} new posts`);
            
            // Pause after insertion
            await sleep(POST_COMMENT_PAUSE);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error inserting new posts: ${errorMsg}`);
            console.error(`❌ Error inserting posts: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`);
            
            // Longer pause after error to let system recover
            await sleep(ERROR_PAUSE / 2);
          }
        }
        
        // Update existing posts
        if (existingPostsForUpdate.length > 0) {
          try {
            logger.info(`Updating ${existingPostsForUpdate.length} existing posts`);
            console.log(`🔄 Updating ${existingPostsForUpdate.length} existing posts...`);
            
            // Process posts in smaller batches
            const postBatchSize = Math.min(10, existingPostsForUpdate.length);
            let updatedPostCount = 0;
            
            for (let i = 0; i < existingPostsForUpdate.length; i += postBatchSize) {
              const postBatch = existingPostsForUpdate.slice(i, i + postBatchSize);
              try {
                // For each post in the batch, manually remove search_vector
                const postsWithoutSearchVector = postBatch.map((post: any) => {
                  const { search_vector, ...rest } = post;
                  return { ...rest, last_checked: new Date() };
                });
                
                // Update posts
                const updatedIds = await dbHandler.updatePosts(postsWithoutSearchVector);
                updatedPostCount += updatedIds.length;
                
                console.log(`  ↳ Updated sub-batch ${Math.floor(i/postBatchSize) + 1}/${Math.ceil(existingPostsForUpdate.length/postBatchSize)}: ${updatedIds.length}/${postBatch.length} posts`);
                
                // Small pause between sub-batches
                if (i + postBatchSize < existingPostsForUpdate.length) {
                  await sleep(1000);
                }
              } catch (batchError) {
                logger.error(`Error updating post sub-batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
                console.error(`  ❌ Error updating post sub-batch: ${(batchError instanceof Error ? batchError.message : String(batchError)).substring(0, 80)}...`);
                // Continue with next sub-batch
              }
            }
            
            stats.updatedPosts += updatedPostCount;
            logger.info(`Successfully updated ${updatedPostCount} existing posts`);
            console.log(`✅ Successfully updated ${updatedPostCount}/${existingPostsForUpdate.length} posts`);
            
            // Pause after updates
            await sleep(POST_COMMENT_PAUSE / 2);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error updating posts: ${errorMsg}`);
            console.error(`❌ Error updating posts: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`);
            
            // Pause after error
            await sleep(ERROR_PAUSE / 3);
          }
        }
        
        // ---- HANDLE COMMENTS ----
        
        // Filter comments to only include those with posts that exist in the database
        const validNewComments = newComments.filter((comment: RedditComment) => knownPostIds.has(comment.post_id));
        
        if (validNewComments.length < newComments.length) {
          const skippedCount = newComments.length - validNewComments.length;
          logger.warn(`Skipping ${skippedCount} comments because their parent posts don't exist in the database`);
          console.log(`⚠️  Skipping ${skippedCount} comments (parent posts not found)`);
        }
        
        // Insert new comments (only those with valid post_ids)
        if (validNewComments.length > 0) {
          try {
            logger.info(`Processing ${validNewComments.length} new comments using micro-batching`);
            console.log(`💬 Processing ${validNewComments.length} new comments...`);
            let insertedCount = 0;
            
            // Process comments in very small batches to avoid overwhelming Supabase
            for (let i = 0; i < validNewComments.length; i += COMMENT_BATCH_SIZE) {
              const commentBatch = validNewComments.slice(i, i + COMMENT_BATCH_SIZE);
              try {
                logger.info(`Inserting comment micro-batch ${Math.floor(i/COMMENT_BATCH_SIZE) + 1}/${Math.ceil(validNewComments.length/COMMENT_BATCH_SIZE)}: ${commentBatch.length} comments`);
                console.log(`  ↳ Micro-batch ${Math.floor(i/COMMENT_BATCH_SIZE) + 1}/${Math.ceil(validNewComments.length/COMMENT_BATCH_SIZE)}: ${commentBatch.length} comments`);
                
                const insertedIds = await dbHandler.insertComments(commentBatch);
                insertedCount += insertedIds.length;
                stats.newCommentsInserted += insertedIds.length;
                
                logger.info(`Successfully inserted ${insertedIds.length} comments in this micro-batch`);
                console.log(`    ✓ Inserted ${insertedIds.length}/${commentBatch.length} comments`);
                
                // Significant pause between each micro-batch
                if (i + COMMENT_BATCH_SIZE < validNewComments.length) {
                  await sleep(COMMENT_BATCH_PAUSE);
                }
              } catch (batchError) {
                const errorMsg = batchError instanceof Error ? batchError.message : String(batchError);
                logger.error(`Error inserting comment micro-batch: ${errorMsg}`);
                console.error(`    ❌ Error: ${errorMsg.substring(0, 80)}...`);
                stats.errorCount++;
                
                // Add to retry queue
                addToRetryQueue(commentBatch, stats.currentQuarterName);
                
                // Longer pause after error
                await sleep(ERROR_PAUSE / 2);
              }
            }
            
            logger.info(`Completed comment processing: inserted ${insertedCount}/${validNewComments.length} new comments`);
            console.log(`  ✅ Completed: ${insertedCount}/${validNewComments.length} comments inserted, ${commentRetryQueue.length} queued for retry`);
            
            // Extra pause after all comment insertion attempts
            await sleep(POST_COMMENT_PAUSE);
            
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error in comment insertion process: ${errorMsg}`);
            console.error(`❌ Error in comment insertion process: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`);
            
            // Longer pause after error
            await sleep(ERROR_PAUSE);
          }
        }
        
        // Update existing comments
        if (existingCommentsForUpdate.length > 0) {
          try {
            logger.info(`Updating ${existingCommentsForUpdate.length} existing comments`);
            console.log(`🔄 Updating ${existingCommentsForUpdate.length} existing comments...`);
            
            // Process comments in smaller batches to avoid overwhelming Supabase
            const commentBatchSize = Math.min(10, existingCommentsForUpdate.length);
            let updatedCount = 0;
            
            for (let i = 0; i < existingCommentsForUpdate.length; i += commentBatchSize) {
              const commentBatch = existingCommentsForUpdate.slice(i, i + commentBatchSize);
              try {
                // For each comment in the batch, manually remove search_vector
                const commentsWithoutSearchVector = commentBatch.map((comment: any) => {
                  const { search_vector, ...rest } = comment;
                  return { ...rest, last_checked: new Date() };
                });
                
                // Update comments
                const updatedIds = await dbHandler.updateComments(commentsWithoutSearchVector);
                updatedCount += updatedIds.length;
                
                console.log(`  ↳ Updated sub-batch ${Math.floor(i/commentBatchSize) + 1}/${Math.ceil(existingCommentsForUpdate.length/commentBatchSize)}: ${updatedIds.length}/${commentBatch.length} comments`);
                
                // Small pause between sub-batches
                if (i + commentBatchSize < existingCommentsForUpdate.length) {
                  await sleep(1000);
                }
              } catch (batchError) {
                logger.error(`Error updating comment sub-batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
                console.error(`  ❌ Error updating comment sub-batch: ${(batchError instanceof Error ? batchError.message : String(batchError)).substring(0, 80)}...`);
                // Continue with next sub-batch
              }
            }
            
            stats.updatedComments += updatedCount;
            logger.info(`Successfully updated ${updatedCount} existing comments`);
            console.log(`✅ Successfully updated ${updatedCount}/${existingCommentsForUpdate.length} comments`);
          } catch (error) {
            stats.errorCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Error updating comments: ${errorMsg}`);
            console.error(`❌ Error updating comments: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`);
          }
        }
        
        // Process retry queue periodically after every 5 batches
        if (stats.batchesProcessed % 5 === 0 && commentRetryQueue.length > 0) {
          await processRetryQueue(dbHandler);
        }
        
        // Add pause after entire batch
        logger.debug(`Pausing for ${BATCH_PAUSE/1000} seconds after batch...`);
        await sleep(BATCH_PAUSE);
        
      } catch (error) {
        stats.errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing batch: ${errorMessage}`);
        console.error(`❌ Error in batch #${stats.batchesProcessed}: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`);
        
        // Longer pause after batch error
        await sleep(ERROR_PAUSE);
      }
    };

    // Process all quarters with enhanced retry logic
    for (let quarterIndex = 0; quarterIndex < QUARTERS.length; quarterIndex++) {
      const selectedQuarter = QUARTERS[quarterIndex];
      stats.currentQuarter = quarterIndex;
      stats.currentQuarterName = selectedQuarter.name;
      
      logger.info(`Starting to process quarter ${quarterIndex + 1}/${QUARTERS.length}: ${selectedQuarter.name}`);
      console.log(`\n\n▶️  QUARTER ${quarterIndex + 1}/${QUARTERS.length}: ${selectedQuarter.name}`);
      console.log(`═════════════════════════════════════════════════════`);
      
      try {
        await processQuarterWithRetry(fetcher, processBatch, selectedQuarter, MAX_RETRIES);
        
        logger.info(`Completed processing quarter ${selectedQuarter.name}`);
        console.log(`\n✅ COMPLETED: Quarter ${selectedQuarter.name}`);
        
        // Process retry queue after each quarter
        if (commentRetryQueue.length > 0) {
          await processRetryQueue(dbHandler);
        }
        
        // Print progress after each quarter
        printProgressSummary(true);
        
        // Add a longer pause between quarters to let the system breathe
        console.log(`\n⏳ Pausing for 60 seconds before next quarter...`);
        await sleep(60000); // Full minute between quarters
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to process quarter ${selectedQuarter.name}: ${errorMessage}`);
        console.error(`\n❌ FAILED: Quarter ${selectedQuarter.name}: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`);
        
        // Continue with next quarter despite failure
        await sleep(ERROR_PAUSE);
      }
    }
    
    // Final processing of any remaining items in retry queue
    if (commentRetryQueue.length > 0) {
      console.log(`\n🔄 Final processing of retry queue (${commentRetryQueue.length} batches)...`);
      await processRetryQueue(dbHandler);
    }
    
    logger.info('Completed processing all quarters');
    console.log('\n\n✅✅✅ COMPLETED DAILY REDDIT UPDATE ✅✅✅');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${errorMessage}`);
    console.error(`\n\n❌ FATAL ERROR: ${errorMessage.substring(0, 150)}${errorMessage.length > 150 ? '...' : ''}`);
  } finally {
    printProgressSummary(true);
  }
}

// Run the script
fetchDailyReddit().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 