// check-latest-errors.ts
// Script to check the latest error messages from failed queue items
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function checkLatestErrors() {
  try {
    console.log('🔍 Checking latest errors in the embedding queue...');
    
    // Get the most recent failed items with their error messages
    const failedItemsResult = await pool.query(`
      SELECT 
        id, 
        record_id, 
        table_name,
        content_function, 
        last_error,
        attempts,
        processed_at
      FROM util.embedding_queue
      WHERE status = 'failed'
      ORDER BY processed_at DESC
      LIMIT 5;
    `);
    
    console.log('\n📊 Most recent failed items:');
    if (failedItemsResult.rows.length === 0) {
      console.log('No failed items found!');
    } else {
      failedItemsResult.rows.forEach(item => {
        console.log(`\n🔴 Item ID: ${item.id}`);
        console.log(`  Record ID: ${item.record_id}`);
        console.log(`  Table: ${item.table_name}`);
        console.log(`  Function: ${item.content_function}`);
        console.log(`  Attempts: ${item.attempts}`);
        console.log(`  Processed at: ${item.processed_at}`);
        console.log(`  Error: ${item.last_error}`);
      });
    }
    
    // Test a wrapper function directly
    if (failedItemsResult.rows.length > 0) {
      const sampleItem = failedItemsResult.rows[0];
      console.log(`\n🧪 Testing wrapper function directly with record ${sampleItem.record_id}...`);
      
      try {
        // Test with JSON format
        const jsonResult = await pool.query(`
          SELECT ${sampleItem.content_function}(
            json_build_object('id', '${sampleItem.record_id}')
          ) as result;
        `);
        
        console.log(`✅ Direct function call result (JSON): ${typeof jsonResult.rows[0]?.result}`);
        if (jsonResult.rows[0]?.result) {
          const resultValue = jsonResult.rows[0].result;
          console.log(`  Result value: ${typeof resultValue === 'string' ? resultValue.substring(0, 50) + '...' : JSON.stringify(resultValue)}`);
        }
      } catch (error) {
        console.error(`❌ Error calling with JSON parameter:`, error);
      }
      
      try {
        // Try with direct function call
        const checkRecordResult = await pool.query(`
          SELECT id, content FROM ${sampleItem.table_name}
          WHERE id = '${sampleItem.record_id}'
          LIMIT 1;
        `);
        
        console.log(`\n🔍 Record details from database:`);
        if (checkRecordResult.rows.length > 0) {
          console.log(`  Content: ${checkRecordResult.rows[0].content?.substring(0, 50)}...`);
        } else {
          console.log(`  ❌ Record not found in database!`);
        }
      } catch (error) {
        console.error(`❌ Error checking record:`, error);
      }
    }
    
    // Check the function definition as seen by the edge function
    console.log('\n🔍 Checking function definition seen by edge function...');
    
    try {
      const functionDefResult = await pool.query(`
        SELECT 
          proname as function_name,
          proargnames as arg_names,
          proargtypes as arg_types,
          proargmodes as arg_modes,
          prorettype as return_type,
          proargtypes as arg_type_ids
        FROM pg_proc
        WHERE proname LIKE '%wrapper%' OR proname = 'update_comment_embedding'
        LIMIT 10;
      `);
      
      console.log('Function metadata from pg_proc:');
      functionDefResult.rows.forEach(func => {
        console.log(`- ${func.function_name}:`);
        console.log(`  Arg names: ${func.arg_names}`);
        console.log(`  Arg types: ${func.arg_types}`);
        console.log(`  Return type: ${func.return_type}`);
      });
    } catch (error) {
      console.error(`❌ Error checking function definition:`, error);
    }
    
    // Final queue status
    const queueStatusResult = await pool.query(`
      SELECT 
        status, 
        COUNT(*) as count
      FROM util.embedding_queue
      GROUP BY status
      ORDER BY status;
    `);
    
    console.log('\n📊 Current queue status:');
    queueStatusResult.rows.forEach(row => {
      console.log(`- ${row.status}: ${row.count} items`);
    });
    
    // Print the fix suggestion
    console.log('\n📋 Potential fix based on the edge function implementation:');
    console.log(`The edge function in process-queue/index.ts does:
1. Get content using specified function:
   const { data: content, error: contentError } = await supabaseClient.rpc(
     job.content_function,
     { post_record: { id: job.record_id } }
   );

2. Then expects 'content' to be a string:
   console.log(\`Generated content for \${job.record_id}: "\${content.substring(0, 50)}..."\`);

Let's try creating a simplified wrapper function that just returns the content as text:

CREATE OR REPLACE FUNCTION public.update_comment_embedding_simple(post_record json)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simply return the actual content from the comments table
  RETURN (
    SELECT content FROM reddit_comments 
    WHERE id = (post_record->>'id')::text
  );
END;
$$;
`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
checkLatestErrors(); 