// check-failure-reasons.ts
// Script to check the actual error messages of failed queue items
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function checkFailureReasons() {
  try {
    console.log('🔍 Checking failure reasons in the embedding queue...');
    
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
      LIMIT 10;
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
    
    // Check if the wrapper functions are correctly defined
    const wrapperFunctionsResult = await pool.query(`
      SELECT 
        routine_name, 
        routine_type,
        data_type as return_type,
        pg_get_function_arguments(p.oid) AS args,
        prosrc as function_body
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name LIKE '%wrapper%'
      ORDER BY routine_name;
    `);
    
    console.log('\n📊 Wrapper function definitions:');
    if (wrapperFunctionsResult.rows.length === 0) {
      console.log('No wrapper functions found!');
    } else {
      wrapperFunctionsResult.rows.forEach(func => {
        console.log(`\n🔧 Function: ${func.routine_name}`);
        console.log(`  Arguments: ${func.args}`);
        console.log(`  Return type: ${func.return_type}`);
        console.log(`  Function body: ${func.function_body}`);
      });
    }
    
    // Find what's expected by the process-queue edge function
    console.log('\n🔍 Testing wrapper functions...');
    
    // Let's attempt to directly call one wrapper function with correct parameter format to see if it works
    try {
      const testResult = await pool.query(`
        SELECT public.update_comment_embedding_wrapper(jsonb_build_object('id', (
          SELECT record_id FROM util.embedding_queue 
          WHERE status = 'failed' AND content_function = 'update_comment_embedding_wrapper'
          LIMIT 1
        ))) as result;
      `);
      
      console.log(`\n✅ Direct wrapper function test result: ${JSON.stringify(testResult.rows[0]?.result || 'No result')}`);
    } catch (error) {
      console.error(`\n❌ Direct wrapper function test error:`, error);
    }
    
    // Check if there's a parameter type mismatch (jsonb vs json)
    const parameterTypeResult = await pool.query(`
      SELECT 
        routine_name, 
        parameter_name,
        data_type,
        parameter_mode
      FROM information_schema.parameters
      WHERE specific_schema = 'public'
        AND (
          routine_name LIKE '%wrapper%' OR 
          routine_name IN ('comment_embedding_input', 'get_comment_content', 'get_post_content')
        )
      ORDER BY routine_name, ordinal_position;
    `);
    
    console.log('\n📊 Parameter types:');
    parameterTypeResult.rows.forEach(param => {
      console.log(`- ${param.routine_name}: ${param.parameter_name} (${param.data_type})`);
    });
    
    // Check the function we're calling vs what is being passed
    console.log('\n🔍 Parameter comparison:');
    console.log('Edge function in process-queue/index.ts:');
    console.log('- Calls: supabaseClient.rpc(job.content_function, { post_record: { id: job.record_id } })');
    
    // Fix proposal - create new wrappers with json parameter type
    console.log('\n📋 Proposed fix:');
    console.log('Create wrapper functions that explicitly use json type if needed:');
    console.log(`
CREATE OR REPLACE FUNCTION public.update_comment_embedding_wrapper(post_record json)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  extracted_content json;
BEGIN
  -- Extract the ID as first parameter (casting explicitly to text)
  PERFORM public.update_comment_embedding(
    (post_record->>'id')::text,
    NULL::double precision[]
  );
  
  -- For compatibility, return something
  extracted_content := json_build_object('id', post_record->>'id');
  RETURN extracted_content;
END;
$$;
    `);
    
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
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
checkFailureReasons(); 