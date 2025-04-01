import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Determine and load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('EmbeddingQueueTest');

async function testEmbeddingQueue() {
  logger.info('Starting embedding queue test');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Get a random post to update
    logger.info('Fetching a random post to update');
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('id, title')
      .limit(1);
    
    if (postsError) {
      logger.error(`Error fetching post: ${postsError.message}`);
      process.exit(1);
    }
    
    if (!posts || posts.length === 0) {
      logger.error('No posts found to update');
      process.exit(1);
    }
    
    const post = posts[0];
    logger.info(`Found post: ${post.id} with title: "${post.title}"`);
    
    // Check if we have any items in the queue before we start
    const { data: queueCount, error: countError } = await supabase
      .from('util_embedding_queue_count')
      .select('count')
      .single();
    
    if (countError) {
      logger.info(`Could not get queue count: ${countError.message}`);
      logger.info('This is not critical, continuing with test');
    } else {
      logger.info(`Current embedding queue has ${queueCount?.count || 'unknown'} items total`);
    }
    
    // 3. Update the post directly (without disabling triggers)
    logger.info(`Updating post ${post.id} directly`);
    
    // Add a timestamp to ensure content actually changes
    const timestamp = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('reddit_posts')
      .update({
        title: `${post.title} (Test update: ${timestamp})`,
        content: `Updated content for test at ${timestamp}`,
        last_checked: new Date()
      })
      .eq('id', post.id);
    
    if (updateError) {
      logger.error(`Error updating post: ${updateError.message}`);
      process.exit(1);
    }
    
    logger.info('Post updated successfully');
    
    // 4. Wait a moment for triggers to process
    logger.info('Waiting for triggers to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Check if there are more items in the queue after update
    const { data: newQueueCount, error: newCountError } = await supabase
      .from('util_embedding_queue_count')
      .select('count')
      .single();
    
    if (newCountError) {
      logger.info(`Could not get new queue count: ${newCountError.message}`);
    } else {
      const oldCount = queueCount?.count || 0;
      const newCount = newQueueCount?.count || 0;
      logger.info(`Queue count before: ${oldCount}, after: ${newCount}`);
      
      if (newCount > oldCount) {
        logger.info('SUCCESS: New items were added to the embedding queue!');
      } else {
        logger.info('FAIL: No new items were added to the embedding queue');
      }
    }
    
    // 6. Verify with a direct SQL query (running directly on the database through Supabase dashboard)
    logger.info('\n--- SQL QUERY TO RUN MANUALLY IN SUPABASE DASHBOARD ---');
    logger.info(`SELECT * FROM util.embedding_queue WHERE record_id = '${post.id}' AND table_name = 'reddit_posts' ORDER BY created_at DESC LIMIT 5;`);
    logger.info('---------------------------------------------------\n');
    
    logger.info('Embedding queue test completed');
    logger.info('Please check database logs and triggers to ensure they are working correctly');
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
testEmbeddingQueue().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 