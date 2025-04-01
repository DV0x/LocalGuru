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
const BATCH_SIZE = 25;
const MAX_POSTS_PER_QUARTER = 2500; // Adjust based on subreddit activity

// Initialize logger
const logger = new Logger('AskSFHistoricalStream');

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
  errorCount: 0
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
  console.log(`🔄 Quarters Completed: ${stats.quartersCompleted} of 8`);
  console.log(`📦 Batches Processed: ${stats.batchesProcessed}`);
  console.log(`🌐 API Requests Made: ${stats.apiRequestsMade}`);
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
  // Print a simple progress indicator every 10 requests
  if (stats.apiRequestsMade % 10 === 0) {
    process.stdout.write(`⚡ API Requests: ${stats.apiRequestsMade}, Posts: ${stats.totalPostsFetched}, Time: ${formatTimeElapsed(stats.startTime)}\r`);
  }
}

/**
 * Trigger the embedding process queue
 */
async function triggerProcessQueue(supabaseUrl: string, supabaseKey: string): Promise<void> {
  logger.info('Triggering process-queue Edge Function');
  
  try {
    trackApiRequest();
    const response = await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        batchSize: config.processQueue.batchSize || 10
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger process-queue: ${errorText}`);
    }
    
    logger.info('Successfully triggered process-queue');
  } catch (error) {
    stats.errorCount++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error triggering process-queue: ${errorMessage}`);
  }
}

/**
 * Process a specific quarter of data
 */
async function processQuarter(
  fetcher: RedditFetcher,
  batchProcessor: BatchProcessor,
  quarter: { 
    name: string;
    sort: 'new' | 'hot' | 'top';
    time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' 
  }
): Promise<void> {
  logger.info(`Processing ${quarter.name} data for r/${SUBREDDIT} using ${quarter.sort} posts by ${quarter.time}`);
  console.log('\n' + '-'.repeat(60));
  console.log(`🔍 STARTING QUARTER: ${quarter.name} (${quarter.sort} by ${quarter.time})`);
  console.log('-'.repeat(60) + '\n');
  
  const quarterStartTime = new Date();
  
  try {
    // Track original API request counter to calculate requests for this quarter
    const startingApiRequests = stats.apiRequestsMade;
    
    // Stream subreddit data using batch processor
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
    stats.quartersCompleted++;
    
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
    
    return;
  } catch (error) {
    stats.errorCount++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing ${quarter.name}: ${errorMessage}`);
    throw error;
  }
}

// Custom batch processor interface
interface BatchProcessor {
  processBatch(posts: RedditPost[], comments: RedditComment[]): Promise<void>;
}

/**
 * Main function to fetch historical data from AskSF subreddit
 */
async function fetchAskSFHistorical() {
  console.log('\n' + '*'.repeat(80));
  console.log(`🚀 STARTING HISTORICAL DATA INGESTION FOR r/${SUBREDDIT}`);
  console.log('*'.repeat(80) + '\n');
  
  logger.info(`Starting historical data fetching for r/${SUBREDDIT} using streaming approach`);

  try {
    // Initialize Supabase client parameters
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }

    // Initialize database handler
    const dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
      batchSize: config.database.batchSize || 50,
      retryAttempts: config.database.retryAttempts || 3,
      disableTriggers: config.database.disableTriggers || false
    });

    // Initialize change detector
    const changeDetector = new ChangeDetector({
      checksumFields: config.changeDetection.checksumFields || ['title', 'content', 'score'],
      ignoreFields: config.changeDetection.ignoreFields || ['last_updated'],
      forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays || 7
    });

    // Initialize Reddit fetcher with custom checkpoint directory
    const fetcher = new RedditFetcher({
      userAgent: process.env.REDDIT_USER_AGENT || 'Localguru/1.0 (AskSF Data Ingestion)',
      requestDelay: parseInt(process.env.REDDIT_REQUEST_DELAY || '2000', 10),
      checkpointDir: path.join(process.cwd(), 'checkpoints', SUBREDDIT)
    });
    
    // Track API requests manually instead of monkey patching
    // We'll increment the counter in our processing logic
    
    // Increment API counter at the start
    trackApiRequest();

    // Create custom batch processor
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
          
          // Get existing content for change detection
          const existingPosts = await dbHandler.getExistingPosts(postIds);
          const existingComments = await dbHandler.getExistingComments(commentIds);
          
          // Detect changes
          const postChanges = await changeDetector.detectPostChanges(posts, existingPosts);
          const commentChanges = await changeDetector.detectCommentChanges(comments, existingComments);
          
          // Skip if no changes
          if (!postChanges.new.length && !postChanges.updated.length && 
              !commentChanges.new.length && !commentChanges.updated.length) {
            logger.info('No changes detected in this batch');
            console.log(`⏩ Batch #${stats.batchesProcessed}: No changes detected, skipping DB operations`);
            return;
          }
          
          // Perform database operations
          await dbHandler.disableTriggers();
          
          let newPostIds: string[] = [];
          let updatedPostIds: string[] = [];
          let newCommentIds: string[] = [];
          let updatedCommentIds: string[] = [];
          
          if (postChanges.new.length) {
            newPostIds = await dbHandler.insertPosts(postChanges.new);
            stats.newPostsInserted += newPostIds.length;
          }
          
          if (postChanges.updated.length) {
            updatedPostIds = await dbHandler.updatePosts(postChanges.updated);
            stats.updatedPosts += updatedPostIds.length;
          }
          
          if (commentChanges.new.length) {
            newCommentIds = await dbHandler.insertComments(commentChanges.new);
            stats.newCommentsInserted += newCommentIds.length;
          }
          
          if (commentChanges.updated.length) {
            updatedCommentIds = await dbHandler.updateComments(commentChanges.updated);
            stats.updatedComments += updatedCommentIds.length;
          }
          
          await dbHandler.enableTriggers();
          
          // Clear the progress line
          process.stdout.write(' '.repeat(100) + '\r');
          
          console.log(`✅ Batch #${stats.batchesProcessed} complete: +${newPostIds.length} new posts, +${newCommentIds.length} new comments`);
          
          logger.info(`Processed batch: ${postChanges.new.length} new posts, ${postChanges.updated.length} updated posts, ` +
                      `${commentChanges.new.length} new comments, ${commentChanges.updated.length} updated comments`);
        } catch (error) {
          stats.errorCount++;
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`Error processing batch: ${err.message}`);
          console.log(`❌ Error in batch #${stats.batchesProcessed}: ${err.message}`);
          throw err; // Re-throw to allow retry logic in caller
        }
      }
    };
    
    // Define quarters to process
    // Process in quarters (3-month periods) to manage data volume
    const quarters = [
      { name: 'Q1-top', sort: 'top' as const, time: 'month' as const },
      { name: 'Q2-top', sort: 'top' as const, time: 'month' as const },
      { name: 'Q3-top', sort: 'top' as const, time: 'month' as const },
      { name: 'Q4-top', sort: 'top' as const, time: 'month' as const },
      // Additional passes with 'new' to catch posts that weren't top-ranked
      { name: 'Q1-new', sort: 'new' as const, time: 'month' as const },
      { name: 'Q2-new', sort: 'new' as const, time: 'month' as const },
      { name: 'Q3-new', sort: 'new' as const, time: 'month' as const },
      { name: 'Q4-new', sort: 'new' as const, time: 'month' as const },
    ];

    // Initial stats printout
    printProgressSummary();
    
    // Process each quarter
    for (const quarter of quarters) {
      logger.info(`Starting to process ${quarter.name}`);
      
      try {
        await processQuarter(fetcher, batchProcessor, quarter);
        
        // Trigger embedding process after each quarter
        if (config.processQueue.triggerAfterIngestion) {
          await triggerProcessQueue(supabaseUrl, supabaseKey);
        }
        
        logger.info(`Completed processing ${quarter.name}`);
      } catch (error) {
        stats.errorCount++;
        logger.error(`Failed to process ${quarter.name}, continuing to next quarter`);
        console.log(`❌ Quarter ${quarter.name} failed, continuing to next quarter`);
        // Continue with next quarter even if this one fails
      }
    }

    logger.info(`Completed all quarters for r/${SUBREDDIT}`);
    
    // Final status check
    try {
      console.log('\n' + '*'.repeat(80));
      console.log(`🏁 FINAL DATABASE STATS FOR r/${SUBREDDIT}`);
      console.log('*'.repeat(80));
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { count: postCount } = await supabase
        .from('reddit_posts')
        .select('*', { count: 'exact', head: true })
        .eq('subreddit', SUBREDDIT);
      
      // Using a simpler query to avoid type issues
      const { data: postIds } = await supabase
        .from('reddit_posts')
        .select('id')
        .eq('subreddit', SUBREDDIT);
      
      // If we have posts, count comments
      let commentCount = 0;
      if (postIds && postIds.length > 0) {
        const ids = postIds.map(p => p.id);
        const { count } = await supabase
          .from('reddit_comments')
          .select('*', { count: 'exact', head: true })
          .in('post_id', ids);
        
        if (count !== null) {
          commentCount = count;
        }
      }
      
      // Run a custom query to get queue status
      const { data: queueStats } = await supabase.rpc(
        'get_embedding_queue_stats',
        { 
          p_table_name: 'reddit_posts',
          p_subreddit: SUBREDDIT
        }
      );
      
      console.log(`📊 DATABASE RECORDS:`);
      console.log(`   Total Posts: ${postCount || 0}`);
      console.log(`   Total Comments: ${commentCount}`);
      console.log(`   Posts per Comment Ratio: ${commentCount > 0 ? (commentCount / (postCount || 1)).toFixed(2) : 0}`);
      console.log('-'.repeat(60));
      
      console.log(`📋 EMBEDDING QUEUE STATUS:`);
      if (queueStats && queueStats.length > 0) {
        queueStats.forEach((stat: any) => {
          console.log(`   ${stat.status}: ${stat.count}`);
        });
      } else {
        console.log('   No items in embedding queue or custom function not available');
        // Fallback to simple count if RPC function is not available
        const { count: pendingCount } = await supabase
          .from('util.embedding_queue')
          .select('*', { count: 'exact', head: true })
          .eq('table_name', 'reddit_posts')
          .eq('subreddit', SUBREDDIT)
          .eq('status', 'pending');
          
        if (pendingCount !== null) {
          console.log(`   pending: ${pendingCount}`);
        }
      }
      
      console.log('-'.repeat(60));
      console.log(`⏱️ TOTAL TIME: ${formatTimeElapsed(stats.startTime)}`);
      console.log('*'.repeat(80) + '\n');
      
      logger.info(`Total records in database: ${postCount || 0} posts and ${commentCount} comments for r/${SUBREDDIT}`);
    } catch (error) {
      stats.errorCount++;
      logger.error('Failed to get final record counts');
      console.log('❌ Failed to get final database statistics');
    }
    
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error during historical ingestion: ${errorObj.message}`, errorObj);
    
    if (errorObj.stack) {
      logger.error(`Stack trace: ${errorObj.stack}`);
    }
    
    console.log('\n' + '*'.repeat(80));
    console.log(`❌ INGESTION FAILED: ${errorObj.message}`);
    console.log('*'.repeat(80) + '\n');
    
    // Print final summary even on error
    printProgressSummary();
    
    process.exit(1);
  }
  
  // Final summary
  console.log('\n' + '*'.repeat(80));
  console.log(`✅ INGESTION COMPLETED SUCCESSFULLY`);
  console.log('*'.repeat(80) + '\n');
  
  printProgressSummary();
}

// Run the main function
fetchAskSFHistorical().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Application error:', errorObj);
  process.exit(1);
}); 