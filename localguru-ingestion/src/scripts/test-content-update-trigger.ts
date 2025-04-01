import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('ContentUpdateTest');

async function testContentUpdateTrigger() {
  logger.info('Starting content update trigger test');

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
      .select('id, title, content')
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
    
    // 2. Check if this post is already in the embedding queue
    logger.info('Running SQL to check if post is already in the embedding queue');
    logger.info(`SQL: SELECT * FROM util.embedding_queue WHERE record_id = '${post.id}' AND table_name = 'reddit_posts'`);
    logger.info('Please run this SQL manually in the Supabase dashboard and note any results');
    
    // 3. Update the post content directly
    logger.info(`Updating post ${post.id} content directly`);
    
    // Add a timestamp to ensure content actually changes
    const timestamp = new Date().toISOString();
    const updatedTitle = `${post.title} (Test update: ${timestamp})`;
    
    // Only update the title field which we know should trigger the embedding
    const { error: updateError } = await supabase
      .from('reddit_posts')
      .update({
        title: updatedTitle
      })
      .eq('id', post.id);
    
    if (updateError) {
      logger.error(`Error updating post: ${updateError.message}`);
      process.exit(1);
    }
    
    logger.info('Post title updated successfully');
    logger.info(`New title: "${updatedTitle}"`);
    
    // 4. Wait a moment for triggers to process
    logger.info('Waiting for triggers to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Provide SQL to check the embedding queue after update
    logger.info('\n--- SQL QUERY TO RUN MANUALLY IN SUPABASE DASHBOARD ---');
    logger.info(`SELECT * FROM util.embedding_queue WHERE record_id = '${post.id}' AND table_name = 'reddit_posts' ORDER BY created_at DESC LIMIT 5;`);
    logger.info('---------------------------------------------------');
    logger.info('Please run this SQL in the Supabase dashboard to check if a new entry was added');
    logger.info('\nIf you see a new entry with created_at timestamp close to the current time,');
    logger.info('it confirms the trigger is working correctly when content is updated.');
    
    logger.info('Content update trigger test completed');
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
testContentUpdateTrigger().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 