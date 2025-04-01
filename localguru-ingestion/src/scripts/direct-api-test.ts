import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('DirectAPITest');

async function testDirectAPI() {
  logger.info('Starting direct API test for embedding queue triggers');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Get post to work with
    logger.info('Fetching post to update');
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('id, title')
      .limit(1);
    
    if (postsError) {
      logger.error(`Error fetching posts: ${postsError.message}`);
      process.exit(1);
    }
    
    if (!posts || posts.length === 0) {
      logger.error('No posts found');
      process.exit(1);
    }
    
    const post = posts[0];
    logger.info(`Selected post ID: ${post.id}, current title: ${post.title}`);
    
    // 2. Check current queue status
    logger.info('Checking current queue status for this post');
    
    const { data: initialQueue, error: initialQueueError } = await supabase
      .from('embedding_queue')
      .select('*')
      .eq('record_id', post.id)
      .eq('table_name', 'reddit_posts')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (initialQueueError) {
      logger.error(`Error checking queue: ${initialQueueError.message}`);
    } else {
      if (initialQueue && initialQueue.length > 0) {
        logger.info(`Found ${initialQueue.length} existing queue entries for this post`);
        initialQueue.forEach((item, i) => {
          logger.info(`Entry ${i + 1}: created at ${item.created_at}, status: ${item.status}`);
        });
      } else {
        logger.info('No existing queue entries found for this post');
      }
    }
    
    // 3. Update the post
    const timestamp = new Date().toISOString();
    const newTitle = `${post.title} [Updated at ${timestamp}]`;
    
    logger.info(`Updating post title to: ${newTitle}`);
    
    const { data: updateResult, error: updateError } = await supabase
      .from('reddit_posts')
      .update({ 
        title: newTitle
      })
      .eq('id', post.id)
      .select();
    
    if (updateError) {
      logger.error(`Error updating post: ${updateError.message}`);
      process.exit(1);
    } else {
      logger.info(`Update successful: ${JSON.stringify(updateResult)}`);
    }
    
    // 4. Wait a moment for triggers to process
    logger.info('Waiting for triggers to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. Check queue again to see if new items were added
    logger.info('Checking queue status after update');
    
    const { data: finalQueue, error: finalQueueError } = await supabase
      .from('embedding_queue')
      .select('*')
      .eq('record_id', post.id)
      .eq('table_name', 'reddit_posts')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (finalQueueError) {
      logger.error(`Error checking queue after update: ${finalQueueError.message}`);
    } else {
      if (finalQueue && finalQueue.length > 0) {
        logger.info(`Found ${finalQueue.length} queue entries after update`);
        finalQueue.forEach((item, i) => {
          logger.info(`Entry ${i + 1}: created at ${item.created_at}, status: ${item.status}`);
          
          // Check if this is a new entry
          const itemDate = new Date(item.created_at);
          const nowDate = new Date();
          const diffSeconds = (nowDate.getTime() - itemDate.getTime()) / 1000;
          
          if (diffSeconds < 10) {
            logger.info(`FOUND NEW ENTRY! Created ${diffSeconds.toFixed(1)} seconds ago`);
          }
        });
        
        // Compare with initial queue to identify new entries
        if (initialQueue) {
          const initialIds = new Set(initialQueue.map(item => item.id));
          const newEntries = finalQueue.filter(item => !initialIds.has(item.id));
          
          if (newEntries.length > 0) {
            logger.info(`${newEntries.length} new entries identified compared to initial check`);
            newEntries.forEach((item, i) => {
              logger.info(`New entry ${i + 1}: ID ${item.id}, created at ${item.created_at}`);
            });
            logger.info('TRIGGER IS WORKING!');
          } else {
            logger.info('No new entries identified compared to initial check');
            logger.info('TRIGGER MAY NOT BE WORKING!');
          }
        }
      } else {
        logger.info('No queue entries found after update. Triggers are not working.');
      }
    }
    
    logger.info('Direct API test completed');
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
testDirectAPI().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 