import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('QueryEmbeddingQueue');

async function queryEmbeddingQueue() {
  logger.info('Starting embedding queue query test');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Get post to use as reference
    logger.info('Fetching a post ID for reference');
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
    
    const postId = posts[0].id;
    logger.info(`Reference post ID: ${postId}`);
    
    // 2. Try to query the embedding queue in the util schema
    logger.info('Querying embedding queue in util schema');
    
    try {
      const { data, error } = await supabase
        .from('util.embedding_queue')
        .select('*')
        .limit(5);
      
      if (error) {
        logger.error(`Error querying util.embedding_queue: ${error.message}`);
      } else {
        logger.info(`Successfully queried util.embedding_queue. Found ${data.length} entries`);
        if (data.length > 0) {
          logger.info(`First entry: ${JSON.stringify(data[0])}`);
        }
      }
    } catch (e) {
      logger.error(`Error accessing util.embedding_queue: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // 3. Try another approach - use the rpc call for the specific post
    logger.info('Trying to use a specific SQL query for the post');
    
    // Use postgres function to check current queue status
    const { data: queueEntries, error: queueError } = await supabase
      .from('reddit_posts')
      .select(`
        id,
        title,
        util_embedding_queue:util.embedding_queue!record_id(*)
      `)
      .eq('id', postId)
      .limit(1);
    
    if (queueError) {
      logger.error(`Error checking queue with join: ${queueError.message}`);
    } else {
      logger.info(`Query result: ${JSON.stringify(queueEntries)}`);
      
      if (queueEntries && queueEntries.length > 0) {
        const entry = queueEntries[0];
        if (entry.util_embedding_queue && entry.util_embedding_queue.length > 0) {
          logger.info(`Found ${entry.util_embedding_queue.length} embedding queue entries for post ${postId}`);
          entry.util_embedding_queue.forEach((item: any, i: number) => {
            logger.info(`Entry ${i + 1}: ${JSON.stringify(item)}`);
          });
        } else {
          logger.info(`No embedding queue entries found for post ${postId}`);
        }
      }
    }
    
    // 4. Try listing the triggers on reddit_posts table
    logger.info('Checking triggers on reddit_posts table');
    
    const { data: triggerData, error: triggerError } = await supabase
      .from('reddit_posts')
      .select('*')
      .limit(1)
      .then(async () => {
        // This is a placeholder - we can't directly query triggers through the Supabase JS client
        // Just letting the user know they need to check manually
        return { 
          data: 'Please check triggers manually in Supabase dashboard', 
          error: null 
        };
      });
    
    logger.info('To check triggers, please run the following SQL in the Supabase dashboard:');
    logger.info(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'reddit_posts'
        AND trigger_schema = 'public'
      ORDER BY trigger_name;
    `);
    
    logger.info('Embedding queue query test completed');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Test failed: ${err.message}`);
    process.exit(1);
  }
}

// Run the query
queryEmbeddingQueue().catch(err => {
  console.error('Query failed:', err);
  process.exit(1);
}); 