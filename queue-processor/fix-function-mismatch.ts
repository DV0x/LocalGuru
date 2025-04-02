// fix-function-mismatch.ts
// Script to fix the function name mismatch in the embedding queue
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function fixFunctionMismatch() {
  try {
    console.log('🔍 Fixing function name mismatch in the embedding queue...');
    
    // First, check what functions are actually available
    const functionsResult = await pool.query(`
      SELECT 
        routine_name, 
        pg_get_function_arguments(p.oid) AS args
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND (
          routine_name LIKE '%embedding%'
          OR routine_name LIKE '%content%'
        )
      ORDER BY routine_name;
    `);
    
    console.log('\n📊 Available embedding-related functions:');
    if (functionsResult.rows.length === 0) {
      console.log('No embedding-related functions found!');
      console.log('We need to fix this by creating the missing function.');
    } else {
      functionsResult.rows.forEach(func => {
        console.log(`- ${func.routine_name}(${func.args})`);
      });
    }
    
    // Check the current failed queue items
    const failedResult = await pool.query(`
      SELECT 
        content_function, 
        COUNT(*) as count
      FROM util.embedding_queue
      WHERE status = 'failed'
      GROUP BY content_function
      ORDER BY count DESC;
    `);
    
    console.log('\n📊 Function names in failed queue items:');
    failedResult.rows.forEach(row => {
      console.log(`- ${row.content_function}: ${row.count} items`);
    });
    
    // Find the correct function to use for comment embeddings
    const commentEmbeddingFunctionsResult = await pool.query(`
      SELECT 
        routine_name, 
        pg_get_function_arguments(p.oid) AS args
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name LIKE '%comment%'
      ORDER BY routine_name;
    `);
    
    // We know comment_embedding_input takes a post_record parameter based on earlier output
    let correctCommentFunction = 'comment_embedding_input';
    
    if (commentEmbeddingFunctionsResult.rows.length > 0) {
      console.log('\n📊 Available comment-related functions:');
      commentEmbeddingFunctionsResult.rows.forEach(func => {
        console.log(`- ${func.routine_name}(${func.args})`);
        
        // Find the function that takes a post_record parameter
        if (func.routine_name.includes('comment') && func.args.includes('post_record')) {
          correctCommentFunction = func.routine_name;
        }
      });
    }
    
    console.log(`\n🔧 Will use ${correctCommentFunction} as the correct function for comments`);
    
    // Option 1: Update the function name for failed items
    console.log('\n📝 Option 1: Update the function name for failed items...');
    
    // First update previous batch that was changed to update_comment_embedding and failed
    const updatePreviousFixResult = await pool.query(`
      UPDATE util.embedding_queue
      SET 
        status = 'pending',
        content_function = '${correctCommentFunction}',
        attempts = 0,
        last_error = NULL,
        processed_at = NULL
      WHERE 
        status = 'failed' 
        AND content_function = 'update_comment_embedding'
      RETURNING id;
    `);
    
    console.log(`✅ Updated ${updatePreviousFixResult.rowCount} failed items from update_comment_embedding to ${correctCommentFunction}`);
    
    // Then update remaining items with get_comment_content_for_embedding
    const updateFailedResult = await pool.query(`
      UPDATE util.embedding_queue
      SET 
        status = 'pending',
        content_function = '${correctCommentFunction}',
        attempts = 0,
        last_error = NULL,
        processed_at = NULL
      WHERE 
        status = 'failed' 
        AND content_function = 'get_comment_content_for_embedding'
      RETURNING id;
    `);
    
    console.log(`✅ Updated ${updateFailedResult.rowCount} failed items from get_comment_content_for_embedding to ${correctCommentFunction}`);
    
    // Also fix post content function if needed
    const postEmbeddingFunctionsResult = await pool.query(`
      SELECT 
        routine_name, 
        pg_get_function_arguments(p.oid) AS args
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name LIKE '%post%'
        AND routine_name LIKE '%embedding%'
      ORDER BY routine_name;
    `);
    
    let correctPostFunction = 'post_embedding_input';
    
    if (postEmbeddingFunctionsResult.rows.length > 0) {
      console.log('\n📊 Available post-related functions:');
      postEmbeddingFunctionsResult.rows.forEach(func => {
        console.log(`- ${func.routine_name}(${func.args})`);
        
        // Find functions for post embedding that take post_record
        if (func.routine_name.includes('post') && func.args.includes('post_record')) {
          correctPostFunction = func.routine_name;
        }
      });
    }
    
    console.log(`\n🔧 Will use ${correctPostFunction} as the correct function for posts`);
    
    const updatePostResult = await pool.query(`
      UPDATE util.embedding_queue
      SET 
        status = 'pending',
        content_function = '${correctPostFunction}',
        attempts = 0,
        last_error = NULL,
        processed_at = NULL
      WHERE 
        status = 'failed' 
        AND content_function = 'get_post_content_for_embedding'
      RETURNING id;
    `);
    
    console.log(`✅ Updated ${updatePostResult.rowCount} failed items from get_post_content_for_embedding to ${correctPostFunction}`);
    
    // Option 2: Create a temporary function that redirects to the correct one
    console.log('\n📝 Option 2: Create a function alias (do this in database)...');
    console.log('To create a function alias, run the following SQL in your database:');
    console.log(`
CREATE OR REPLACE FUNCTION public.get_comment_content_for_embedding(post_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simply redirect to the correct function
  RETURN public.${correctCommentFunction}(post_record);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_post_content_for_embedding(post_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simply redirect to the correct function
  RETURN public.${correctPostFunction}(post_record);
END;
$$;
    `);
    
    // Final queue status after updates
    const finalQueueResult = await pool.query(`
      SELECT 
        status, 
        COUNT(*) as count
      FROM util.embedding_queue
      GROUP BY status
      ORDER BY status;
    `);
    
    console.log('\n📊 Updated queue status:');
    finalQueueResult.rows.forEach(row => {
      console.log(`- ${row.status}: ${row.count} items`);
    });
    
    console.log('\n📋 Next steps:');
    console.log('1. Continue processing the queue with the fixed function names:');
    console.log('   npx ts-node process-all-queue.ts');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
fixFunctionMismatch(); 