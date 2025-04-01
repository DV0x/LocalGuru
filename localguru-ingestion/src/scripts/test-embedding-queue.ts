import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

logger.info(`Using Supabase URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueue() {
  logger.info('Starting embedding queue tests...');

  // Test 1: Try using the check_queue_item_exists function
  try {
    logger.info('Test 1: Using check_queue_item_exists RPC function');
    const { data: existsData, error: existsError } = await supabase
      .rpc('check_queue_item_exists', { 
        item_type: 'post',
        item_id: '123456' 
      });
    
    if (existsError) {
      logger.error(`Error with check_queue_item_exists: ${existsError.message}`);
    } else {
      logger.info(`check_queue_item_exists result: ${existsData}`);
    }
  } catch (error) {
    logger.error(`Exception in Test 1: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 2: Try using the public.embedding_queue view
  try {
    logger.info('Test 2: Querying embedding_queue from public schema');
    const { data: publicItems, error: publicError } = await supabase
      .from('embedding_queue')
      .select('*')
      .limit(5);
    
    if (publicError) {
      logger.error(`Error querying public.embedding_queue: ${publicError.message}`);
    } else {
      logger.info(`Found ${publicItems.length} items in public.embedding_queue`);
      if (publicItems.length > 0) {
        logger.info(`Sample item: ${JSON.stringify(publicItems[0])}`);
      }
    }
  } catch (error) {
    logger.error(`Exception in Test 2: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 3: Try directly accessing util.embedding_queue
  try {
    logger.info('Test 3: Directly accessing util.embedding_queue');
    const { data: utilItems, error: utilError } = await supabase
      .from('util.embedding_queue')
      .select('*')
      .limit(5);
    
    if (utilError) {
      logger.error(`Error accessing util.embedding_queue directly: ${utilError.message}`);
    } else {
      logger.info(`Found ${utilItems?.length || 0} items in util.embedding_queue`);
      if (utilItems && utilItems.length > 0) {
        logger.info(`Sample item: ${JSON.stringify(utilItems[0])}`);
      }
    }
  } catch (error) {
    logger.error(`Exception in Test 3: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 4: Try using the add_to_embedding_queue function
  try {
    logger.info('Test 4: Using add_to_embedding_queue RPC function');
    const { data: addData, error: addError } = await supabase
      .rpc('add_to_embedding_queue', { 
        item_type: 'post',
        item_id: 'test_' + new Date().getTime().toString(),
        item_priority: 10
      });
    
    if (addError) {
      logger.error(`Error with add_to_embedding_queue: ${addError.message}`);
    } else {
      logger.info(`Successfully added item to queue: ${JSON.stringify(addData)}`);
    }
  } catch (error) {
    logger.error(`Exception in Test 4: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the tests
testQueue()
  .then(() => {
    logger.info('Embedding queue tests completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }); 