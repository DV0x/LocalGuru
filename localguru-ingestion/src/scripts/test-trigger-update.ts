import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('TriggerTest');

async function testTriggerWithTitleUpdate() {
  logger.info('Starting trigger test with title update');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Select a post to update
    const postId = '1jh2f4t'; // This is the post we've been examining
    
    // 2. Check current embedding queue entries for this post
    logger.info(`Checking current embedding queue entries for post ${postId}`);
    logger.info('Run this SQL in the Supabase dashboard:');
    logger.info(`
      SELECT * FROM util.embedding_queue 
      WHERE record_id = '${postId}'
      AND table_name = 'reddit_posts'
      ORDER BY created_at DESC;
    `);
    
    // 3. Update only the title field
    const timestamp = new Date().toISOString();
    const newTitle = `Recommendations for Chinese Restaurants in SF with a good vegetarian selection [TEST ${timestamp}]`;
    
    logger.info(`Updating post ${postId} title to: "${newTitle}"`);
    
    // First get the current post to make sure we have valid data
    const { data: currentPost, error: fetchError } = await supabase
      .from('reddit_posts')
      .select('id, title')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      logger.error(`Error fetching post: ${fetchError.message}`);
      process.exit(1);
    }
    
    logger.info(`Current post: ${JSON.stringify(currentPost)}`);
    
    // Update using the data API - simpler approach
    const { data: updateData, error: updateError } = await supabase
      .from('reddit_posts')
      .update({ title: newTitle })
      .eq('id', postId)
      .select();
    
    if (updateError) {
      logger.error(`Error updating post: ${updateError.message}`);
      logger.error(`Error details: ${JSON.stringify(updateError)}`);
      process.exit(1);
    } else {
      logger.info(`Successfully updated post: ${JSON.stringify(updateData)}`);
    }
    
    // 4. Wait a moment for the trigger to process
    logger.info('Waiting 3 seconds for trigger to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. Check embedding queue again
    logger.info('Check the embedding queue again with this SQL:');
    logger.info(`
      SELECT * FROM util.embedding_queue 
      WHERE record_id = '${postId}'
      AND table_name = 'reddit_posts'
      ORDER BY created_at DESC;
    `);
    
    logger.info('If you see a new entry with a timestamp after our update, the trigger is working correctly!');
    logger.info('Trigger test completed');
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
testTriggerWithTitleUpdate().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 