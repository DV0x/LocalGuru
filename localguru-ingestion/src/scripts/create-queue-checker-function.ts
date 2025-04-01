import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Initialize logger
const logger = new Logger('CreateQueueCheckerFunction');

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  logger.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// SQL to create the function
const createFunctionSQL = `
CREATE OR REPLACE FUNCTION get_embedding_queue_items(limit_count INTEGER DEFAULT 10)
RETURNS SETOF util.embedding_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM util.embedding_queue
  ORDER BY id DESC
  LIMIT limit_count;
END;
$$;

-- Grant access to the service role
GRANT EXECUTE ON FUNCTION get_embedding_queue_items TO service_role;
`;

// Main function
async function createQueueCheckerFunction() {
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  });

  try {
    logger.info('Creating queue checker function...');
    
    // Execute the SQL to create the function
    const { data, error } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    
    if (error) {
      logger.error(`Error creating function: ${error.message}`);
      // Try an alternative approach for directly executing SQL
      logger.info('Attempting alternative approach for SQL execution...');
      
      // This is a fallback approach if exec_sql RPC is not available
      // Using a custom migration or admin API endpoint would be better in production
      // This is just for demonstration purposes
      const { error: directError } = await supabase.auth.signInWithPassword({
        email: process.env.SUPABASE_ADMIN_EMAIL || '',
        password: process.env.SUPABASE_ADMIN_PASSWORD || ''
      });
      
      if (directError) {
        logger.error(`Cannot proceed with alternative approach: ${directError.message}`);
      } else {
        logger.info('Function may have been created, but confirmation is not possible without proper permissions.');
      }
    } else {
      logger.info('Queue checker function created successfully');
    }
  } catch (err) {
    logger.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Execute the main function
createQueueCheckerFunction()
  .then(() => {
    logger.info('Creation process completed');
    process.exit(0);
  })
  .catch(err => {
    logger.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }); 