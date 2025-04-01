import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define interfaces for better typing
interface QueueItem {
  id: number;
  table_name: string;
  record_id: string;
  [key: string]: any;
}

async function main() {
  logger.info('Checking embedding queue...');
  
  try {
    // Try using raw SQL query to access the embedding queue
    let queueResult;
    try {
      queueResult = await supabase.rpc('get_embedding_queue_items', { limit_count: 100 });
    } catch (error) {
      logger.info('RPC function not found, trying direct SQL query...');
      // Fallback to direct SQL query
      queueResult = await supabase.from('embedding_queue').select('*').limit(100);
    }

    const { data: queueItems, error: queueError } = queueResult;
    
    if (queueError) {
      logger.error(`Error accessing embedding queue: ${queueError.message}`);
      
      // Try with raw SQL query
      logger.info('Attempting with raw SQL query...');
      let rawResult;
      try {
        rawResult = await supabase.rpc('run_sql', { query: 'SELECT * FROM util.embedding_queue LIMIT 100' });
      } catch (error) {
        logger.info('run_sql RPC not available, trying schema query...');
        rawResult = await supabase.schema('util').from('embedding_queue').select('*').limit(100);
      }
      
      const { data: rawData, error: rawError } = rawResult;
      
      if (rawError) {
        logger.error(`Raw SQL query failed: ${rawError.message}`);
        
        // Test basic database connectivity
        const { data: testData, error: testError } = await supabase
          .from('reddit_posts')
          .select('*', { count: 'exact' })
          .limit(5);
        
        if (testError) {
          logger.error(`Database connectivity issue: ${testError.message}`);
        } else {
          logger.info(`Database is accessible. Found ${testData.length} reddit posts.`);
          logger.info('The embedding queue might be in a different schema or requires special permissions.');
        }
      } else if (rawData) {
        logger.info(`Found ${Array.isArray(rawData) ? rawData.length : 'unknown number of'} items in the embedding queue via raw SQL`);
        if (Array.isArray(rawData) && rawData.length > 0) {
          rawData.slice(0, 10).forEach((item: QueueItem, index: number) => {
            logger.info(`${index + 1}. ${JSON.stringify(item)}`);
          });
        }
      }
    } else if (queueItems) {
      logger.info(`Found ${queueItems.length} items in the embedding queue:`);
      queueItems.slice(0, 10).forEach((item: QueueItem, index: number) => {
        logger.info(`${index + 1}. ${JSON.stringify(item)}`);
      });
    }
  } catch (error) {
    logger.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main()
  .catch(error => {
    logger.error('Error in main function:', error);
    process.exit(1);
  }); 