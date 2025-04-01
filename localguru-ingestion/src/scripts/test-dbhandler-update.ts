import dotenv from 'dotenv';
import { Logger } from '../utils/logger';
import { DBHandler } from '../db/db-handler';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('DBHandlerTest');

async function testDBHandlerUpdate() {
  logger.info('Starting DBHandler update test');

  try {
    // Initialize Supabase client parameters
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    // Initialize DBHandler
    const dbHandler = new DBHandler(supabaseUrl, supabaseKey, {
      batchSize: 1,
      retryAttempts: 3,
      disableTriggers: false // Important: keep triggers enabled
    });
    
    // 1. Fetch a random post using our own Supabase client
    logger.info('Fetching existing posts');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: posts, error: fetchError } = await supabase
      .from('reddit_posts')
      .select('id, title, content')
      .limit(1);
    
    if (fetchError) {
      logger.error(`Error fetching posts: ${fetchError.message}`);
      process.exit(1);
    }
    
    if (!posts || posts.length === 0) {
      logger.error('No posts found to update');
      process.exit(1);
    }
    
    const post = posts[0];
    logger.info(`Found post: ${post.id} with title: "${post.title}"`);
    
    // 2. Modify the post
    const timestamp = new Date().toISOString();
    post.title = `${post.title} (Test update: ${timestamp})`;
    
    // 3. Check if this post is already in the embedding queue
    logger.info('Running SQL to check if post is already in the embedding queue');
    logger.info(`SQL: SELECT * FROM util.embedding_queue WHERE record_id = '${post.id}' AND table_name = 'reddit_posts'`);
    logger.info('Please run this SQL manually in the Supabase dashboard and note any results');
    
    // 4. Update the post using DBHandler
    logger.info(`Updating post ${post.id} using DBHandler`);
    const updatedIds = await dbHandler.updatePosts([post]);
    
    logger.info(`Update completed, affected ${updatedIds.length} posts`);
    logger.info(`New title: "${post.title}"`);
    
    // 5. Wait a moment for triggers to process
    logger.info('Waiting for triggers to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Provide SQL to check the embedding queue after update
    logger.info('\n--- SQL QUERY TO RUN MANUALLY IN SUPABASE DASHBOARD ---');
    logger.info(`SELECT * FROM util.embedding_queue WHERE record_id = '${post.id}' AND table_name = 'reddit_posts' ORDER BY created_at DESC LIMIT 5;`);
    logger.info('---------------------------------------------------');
    logger.info('Please run this SQL in the Supabase dashboard to check if a new entry was added');
    logger.info('\nIf you see a new entry with created_at timestamp close to the current time,');
    logger.info('it confirms the trigger is working correctly when content is updated.');
    
    logger.info('DBHandler update test completed');
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
testDBHandlerUpdate().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 