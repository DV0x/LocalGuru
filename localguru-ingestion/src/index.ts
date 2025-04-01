import dotenv from 'dotenv';
import { config } from './config';
import { applyDatabaseUpdates } from './db';
import { Logger } from './utils/logger';
import { processArgs } from './utils';
import { RedditAPI, RedditFetcher } from './fetchers';
import { ChangeDetector } from './processors';
import { DBHandler } from './db/db-handler';
import { QueueManager } from './queue/queue-manager';

// Load environment variables first
dotenv.config();

// Declare module-level variables to make them accessible to all functions
let logger: Logger;
let fetcher: RedditFetcher;
let dbHandler: DBHandler;
let changeDetector: ChangeDetector;
let queueManager: QueueManager;

// Main function to start the application
async function main() {
  // Initialize logger
  logger = new Logger('Main');
  
  logger.info('Localguru Reddit Ingestion System');
  logger.info('Environment setup complete');
  logger.info('Configuration loaded:', {
    initialSubreddit: config.reddit.initialSubreddit,
    requestDelay: config.reddit.requestDelay,
    logLevel: config.logging.level,
    logFormat: config.logging.format
  });

  // Apply database schema updates
  try {
    logger.info('Applying database schema updates...');
    await applyDatabaseUpdates();
    logger.info('Database schema updated successfully');
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to update database schema:', errorObj);
    process.exit(1);
  }

  // Process command-line arguments
  const args = processArgs();
  const MODE = args.mode || 'ingestion';
  const SUBREDDIT = args.subreddit || config.reddit.initialSubreddit;
  const FETCH_ALL = args.fetchAll === 'true';
  const MONTHS = parseInt(args.months || '12', 10);

  // Initialize Supabase client parameters
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    logger.error('Supabase URL and key must be provided in environment variables');
    process.exit(1);
  }

  // Initialize API and fetcher
  const redditAPI = new RedditAPI({
    userAgent: config.reddit.userAgent,
    requestDelay: config.reddit.requestDelay
  });
  
  fetcher = new RedditFetcher({
    userAgent: config.reddit.userAgent,
    requestDelay: config.reddit.requestDelay
  });

  // Initialize database handler
  dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
    batchSize: config.database.batchSize,
    retryAttempts: config.database.retryAttempts,
    disableTriggers: config.database.disableTriggers
  });

  // Initialize change detector
  changeDetector = new ChangeDetector({
    checksumFields: config.changeDetection.checksumFields,
    ignoreFields: config.changeDetection.ignoreFields,
    forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays
  });

  // Initialize queue manager
  queueManager = new QueueManager(supabaseUrl, supabaseKey, {
    priorityMapping: config.queue.priorityMapping,
    defaultPriority: config.queue.defaultPriority,
    maxQueueSize: config.queue.maxQueueSize,
    cooldownMinutes: config.queue.cooldownMinutes
  });

  logger.info(`Starting data fetch from r/${SUBREDDIT} with a limit of ${FETCH_ALL ? 'all time' : 'recent'}`);

  try {
    switch (MODE) {
      case 'ingestion':
        await runIngestion(SUBREDDIT, FETCH_ALL);
        break;
        
      case 'historical-ingestion':
        await runHistoricalIngestion(SUBREDDIT, MONTHS);
        break;
        
      case 'queue-cleanup':
        await queueManager.cleanupQueue();
        logger.info('Queue cleanup completed');
        break;
        
      case 'trigger-process':
        await triggerProcessQueue();
        break;
        
      default:
        logger.error(`Unknown mode: ${MODE}`);
        process.exit(1);
    }
    
    logger.info('Execution completed successfully');
    process.exit(0);
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error(`Fatal error: ${errorObj.message}`, errorObj);
    process.exit(1);
  }
}

// Function to run the ingestion process
async function runIngestion(subreddit: string, fetchAllTime: boolean): Promise<void> {
  try {
    logger.info(`Starting ingestion for r/${subreddit}${fetchAllTime ? ' (all time)' : ' (recent)'}`);
    
    // 1. Fetch data from Reddit
    const { posts, comments } = await fetcher.fetchSubreddit(subreddit, {
      maxPosts: fetchAllTime ? 1000 : 100,  // Fetch more posts for all-time ingestion
      fetchAllTime: fetchAllTime,
      sort: fetchAllTime ? 'top' : 'new'
    });
    
    logger.info(`Fetched ${posts.length} posts and ${comments.length} comments from r/${subreddit}`);
    
    // 2. Get existing content for change detection
    const postIds = posts.map(p => p.id);
    const commentIds = comments.map(c => c.id);
    
    const existingPosts = await dbHandler.getExistingPosts(postIds);
    const existingComments = await dbHandler.getExistingComments(commentIds);
    
    // 3. Detect changes
    const postChanges = await changeDetector.detectPostChanges(posts, existingPosts);
    const commentChanges = await changeDetector.detectCommentChanges(comments, existingComments);
    
    logger.info(`Detected changes - Posts: ${postChanges.new.length} new, ${postChanges.updated.length} updated`);
    logger.info(`Detected changes - Comments: ${commentChanges.new.length} new, ${commentChanges.updated.length} updated`);
    
    // 4. Handle database operations
    if (config.database.disableTriggers) {
      await dbHandler.disableTriggers();
    }
    
    const newPostIds = await dbHandler.insertPosts(postChanges.new);
    const updatedPostIds = await dbHandler.updatePosts(postChanges.updated);
    const newCommentIds = await dbHandler.insertComments(commentChanges.new);
    const updatedCommentIds = await dbHandler.updateComments(commentChanges.updated);
    
    if (config.database.disableTriggers) {
      await dbHandler.enableTriggers();
    }
    
    // 5. Queue items for embedding
    const queueItems = [
      ...newPostIds.map(id => ({ id, type: 'post' as const, subreddit })),
      ...updatedPostIds.map(id => ({ id, type: 'updated_post' as const, subreddit })),
      ...newCommentIds.map(id => ({ id, type: 'comment' as const, subreddit })),
      ...updatedCommentIds.map(id => ({ id, type: 'updated_comment' as const, subreddit })),
    ];
    
    const queuedCount = await queueManager.queueBatch(queueItems);
    logger.info(`Queued ${queuedCount} items for embedding`);
    
    // 6. Optionally trigger process-queue
    if (config.processQueue.triggerAfterIngestion) {
      await triggerProcessQueue();
    }
    
    // 7. Queue cleanup
    await queueManager.cleanupQueue();
    
    logger.info(`Completed ingestion for r/${subreddit}`);
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error(`Error during ingestion: ${errorObj.message}`, errorObj);
    throw errorObj;
  }
}

// Function to run historical ingestion
async function runHistoricalIngestion(subreddit: string, months: number): Promise<void> {
  try {
    logger.info(`Starting historical ingestion for r/${subreddit} (${months} months)`);
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // 1. Fetch historical data from Reddit
    const { posts, comments } = await fetcher.fetchSubredditHistory(subreddit, {
      startDate,
      endDate: new Date()
    });
    
    logger.info(`Fetched ${posts.length} posts and ${comments.length} comments from r/${subreddit}`);
    
    // 2. Get existing content for change detection
    const postIds = posts.map(p => p.id);
    const commentIds = comments.map(c => c.id);
    
    const existingPosts = await dbHandler.getExistingPosts(postIds);
    const existingComments = await dbHandler.getExistingComments(commentIds);
    
    // 3. Detect changes
    const postChanges = await changeDetector.detectPostChanges(posts, existingPosts);
    const commentChanges = await changeDetector.detectCommentChanges(comments, existingComments);
    
    logger.info(`Detected changes - Posts: ${postChanges.new.length} new, ${postChanges.updated.length} updated`);
    logger.info(`Detected changes - Comments: ${commentChanges.new.length} new, ${commentChanges.updated.length} updated`);
    
    // 4. Handle database operations
    if (config.database.disableTriggers) {
      await dbHandler.disableTriggers();
    }
    
    const newPostIds = await dbHandler.insertPosts(postChanges.new);
    const updatedPostIds = await dbHandler.updatePosts(postChanges.updated);
    const newCommentIds = await dbHandler.insertComments(commentChanges.new);
    const updatedCommentIds = await dbHandler.updateComments(commentChanges.updated);
    
    if (config.database.disableTriggers) {
      await dbHandler.enableTriggers();
    }
    
    // 5. Queue items for embedding
    const queueItems = [
      ...newPostIds.map(id => ({ id, type: 'post' as const, subreddit })),
      ...updatedPostIds.map(id => ({ id, type: 'updated_post' as const, subreddit })),
      ...newCommentIds.map(id => ({ id, type: 'comment' as const, subreddit })),
      ...updatedCommentIds.map(id => ({ id, type: 'updated_comment' as const, subreddit })),
    ];
    
    const queuedCount = await queueManager.queueBatch(queueItems);
    logger.info(`Queued ${queuedCount} items for embedding`);
    
    // 6. Optionally trigger process-queue
    if (config.processQueue.triggerAfterIngestion) {
      await triggerProcessQueue();
    }
    
    // 7. Queue cleanup
    await queueManager.cleanupQueue();
    
    logger.info(`Completed historical ingestion for r/${subreddit}`);
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error(`Error during historical ingestion: ${errorObj.message}`, errorObj);
    throw errorObj;
  }
}

// Function to trigger the process-queue Edge Function
async function triggerProcessQueue(): Promise<void> {
  logger.info('Triggering process-queue Edge Function');
  
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase URL or service key');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        batchSize: config.processQueue.batchSize
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger process-queue: ${errorText}`);
    }
    
    logger.info('Successfully triggered process-queue');
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error(`Error triggering process-queue: ${errorObj.message}`, errorObj);
    // Continue execution even if process-queue trigger fails
  }
}

// Run the main function
main().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Application error:', errorObj);
  process.exit(1);
}); 