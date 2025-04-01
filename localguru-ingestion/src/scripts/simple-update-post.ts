import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { DBHandler } from '../db/db-handler';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('SimpleUpdatePost');

async function simpleUpdatePost() {
  logger.info('Starting simple post update test');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Fetch a post to update (only get essential fields)
    logger.info('Fetching a post to update');
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('id, title')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (postsError) {
      logger.error(`Error fetching posts: ${postsError.message}`);
      process.exit(1);
    }
    
    if (!posts || posts.length === 0) {
      logger.error('No posts found');
      process.exit(1);
    }
    
    const postId = posts[0].id;
    const currentTitle = posts[0].title;
    logger.info(`Selected post ID: ${postId}, current title: ${currentTitle}`);
    
    // 2. Check current queue status for this post
    logger.info('To check current queue status, run this SQL in the Supabase dashboard:');
    logger.info(`
      SELECT * FROM util.embedding_queue 
      WHERE record_id = '${postId}'
      AND table_name = 'reddit_posts'
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    // 3. Initialize DBHandler
    logger.info('Initializing DBHandler');
    const dbHandler = new DBHandler(
      supabaseUrl, 
      supabaseKey, 
      {
        batchSize: 1,
        retryAttempts: 3,
        disableTriggers: false // Keep triggers enabled to test embedding queue
      }
    );
    
    // 4. Create a simplified post object with only essential fields
    const timestamp = new Date().toISOString();
    const simplifiedPost = {
      id: postId,
      title: `${currentTitle} [Simple update: ${timestamp}]`,
      last_checked: new Date() // DBHandler adds this, but we'll add it explicitly too
    };
    
    logger.info(`New title: ${simplifiedPost.title}`);
    
    // 5. Update the post using DBHandler
    logger.info('Updating post using DBHandler');
    
    // First enable triggers (in case they were disabled)
    await dbHandler.enableTriggers();
    
    // Then update the post
    const updatedIds = await dbHandler.updatePosts([simplifiedPost]);
    
    logger.info(`Update result: ${updatedIds.length} posts updated`);
    if (updatedIds.length > 0) {
      logger.info(`Successfully updated post ${updatedIds[0]}`);
    }
    
    // 6. Check the embedding queue after the update
    logger.info('Wait a moment for the trigger to process, then run this SQL in the Supabase dashboard:');
    logger.info(`
      SELECT * FROM util.embedding_queue 
      WHERE record_id = '${postId}'
      AND table_name = 'reddit_posts'
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    logger.info('Simple update test completed');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Test failed: ${err.message}`, err);
    
    if (err.stack) {
      logger.error(`Stack trace: ${err.stack}`);
    }
    
    process.exit(1);
  }
}

// Run the test
simpleUpdatePost().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 