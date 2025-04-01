import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('DirectSQLTest');

async function testDirectSQL() {
  logger.info('Starting direct SQL test for embedding queue triggers');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Get post IDs to work with
    logger.info('Fetching post IDs');
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('id')
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
    logger.info(`Selected post ID: ${postId}`);
    
    // 2. Check current queue status
    logger.info('Checking current queue status for this post');
    
    try {
      // Try to execute a direct SQL query via RPC
      const { data: initialCheck, error: initialError } = await supabase.rpc('run_sql', {
        query: `SELECT * FROM util.embedding_queue 
                WHERE record_id = '${postId}' 
                AND table_name = 'reddit_posts'
                ORDER BY created_at DESC LIMIT 5`
      });
      
      if (initialError) {
        logger.error(`Error with initial check: ${initialError.message}`);
      } else {
        if (initialCheck && initialCheck.length > 0) {
          logger.info(`Found ${initialCheck.length} existing queue entries for this post`);
          initialCheck.forEach((item: any, i: number) => {
            logger.info(`Entry ${i + 1}: created at ${item.created_at}, status: ${item.status}`);
          });
        } else {
          logger.info('No existing queue entries found for this post');
        }
      }
    } catch (e) {
      logger.error(`Error checking queue: ${e instanceof Error ? e.message : String(e)}`);
      logger.info('Will continue with update test');
    }
    
    // 3. Perform a SQL update directly via RPC
    const timestamp = new Date().toISOString();
    const updateSQL = `
      UPDATE reddit_posts 
      SET title = title || ' [Updated at ${timestamp}]' 
      WHERE id = '${postId}' 
      RETURNING id, title
    `;
    
    logger.info('Executing direct SQL update');
    logger.info(`SQL: ${updateSQL}`);
    
    const { data: updateResult, error: updateError } = await supabase.rpc('run_sql', {
      query: updateSQL
    });
    
    if (updateError) {
      logger.error(`Error with update: ${updateError.message}`);
      
      // Try an alternate approach if the first one failed
      logger.info('Trying alternate update approach');
      const { error: altError } = await supabase
        .from('reddit_posts')
        .update({ 
          title: `Updated through direct API at ${timestamp}`
        })
        .eq('id', postId);
      
      if (altError) {
        logger.error(`Alternate update also failed: ${altError.message}`);
      } else {
        logger.info('Alternate update succeeded');
      }
    } else {
      logger.info(`Update successful: ${JSON.stringify(updateResult)}`);
    }
    
    // 4. Wait a moment for triggers to process
    logger.info('Waiting for triggers to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. Check queue again to see if new items were added
    logger.info('Checking queue status after update');
    
    try {
      const { data: finalCheck, error: finalError } = await supabase.rpc('run_sql', {
        query: `SELECT * FROM util.embedding_queue 
                WHERE record_id = '${postId}' 
                AND table_name = 'reddit_posts'
                ORDER BY created_at DESC LIMIT 5`
      });
      
      if (finalError) {
        logger.error(`Error with final check: ${finalError.message}`);
      } else {
        if (finalCheck && finalCheck.length > 0) {
          logger.info(`Found ${finalCheck.length} queue entries after update`);
          finalCheck.forEach((item: any, i: number) => {
            logger.info(`Entry ${i + 1}: created at ${item.created_at}, status: ${item.status}`);
            
            // Check if this is a new entry
            const itemDate = new Date(item.created_at);
            const nowDate = new Date();
            const diffSeconds = (nowDate.getTime() - itemDate.getTime()) / 1000;
            
            if (diffSeconds < 10) {
              logger.info(`FOUND NEW ENTRY! Created ${diffSeconds.toFixed(1)} seconds ago`);
            }
          });
        } else {
          logger.info('No queue entries found after update. Triggers may not be working.');
        }
      }
    } catch (e) {
      logger.error(`Error checking queue after update: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    logger.info('Direct SQL test completed');
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
testDirectSQL().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 