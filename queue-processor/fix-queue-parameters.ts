// fix-queue-parameters.ts
// Script to fix the parameter mismatch by updating both queue entries and adding database wrapper functions
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function fixQueueParameters() {
  try {
    console.log('🔍 Fixing queue parameter mismatch...');
    
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
    functionsResult.rows.forEach(func => {
      console.log(`- ${func.routine_name}(${func.args})`);
    });
    
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
    
    // Find the correct functions for the edge function to call with post_record parameter
    const postRecordFunctions = functionsResult.rows
      .filter(func => func.args.includes('post_record'))
      .map(func => func.routine_name);
    
    console.log('\n📊 Functions that accept post_record parameter:');
    if (postRecordFunctions.length === 0) {
      console.log('No functions found that accept post_record parameter!');
    } else {
      postRecordFunctions.forEach(func => console.log(`- ${func}`));
    }
    
    // Step 1: Create wrapper functions for any that are missing
    console.log('\n🔧 Creating wrapper functions...');
    
    // Create wrapper for update_comment_embedding
    if (!postRecordFunctions.includes('update_comment_embedding_wrapper')) {
      await pool.query(`
        CREATE OR REPLACE FUNCTION public.update_comment_embedding_wrapper(post_record jsonb)
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          extracted_content jsonb;
        BEGIN
          -- The edge function passes record_id inside post_record as {id: "the_id"}
          -- Call update_comment_embedding with the extracted ID
          PERFORM public.update_comment_embedding(
            (post_record->>'id')::text,  -- Extract the ID as first parameter
            NULL                         -- Pass NULL for the embedding_data parameter
          );
          
          -- For compatibility, return something (doesn't matter what)
          extracted_content := jsonb_build_object('id', post_record->>'id');
          RETURN extracted_content;
        END;
        $$;
      `);
      console.log('✅ Created wrapper function for update_comment_embedding');
    } else {
      console.log('✅ Wrapper for update_comment_embedding already exists');
    }
    
    // Create wrapper for update_post_embedding
    if (!postRecordFunctions.includes('update_post_embedding_wrapper')) {
      await pool.query(`
        CREATE OR REPLACE FUNCTION public.update_post_embedding_wrapper(post_record jsonb)
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          extracted_content jsonb;
        BEGIN
          -- The edge function passes record_id inside post_record as {id: "the_id"}
          -- Call update_post_embedding with the extracted ID
          PERFORM public.update_post_embedding(
            (post_record->>'id')::text,  -- Extract the ID as first parameter
            NULL                         -- Pass NULL for the embedding_data parameter
          );
          
          -- For compatibility, return something (doesn't matter what)
          extracted_content := jsonb_build_object('id', post_record->>'id');
          RETURN extracted_content;
        END;
        $$;
      `);
      console.log('✅ Created wrapper function for update_post_embedding');
    } else {
      console.log('✅ Wrapper for update_post_embedding already exists');
    }
    
    // Create wrapper for comment_embedding_input if needed
    if (!postRecordFunctions.includes('comment_embedding_input_wrapper')) {
      await pool.query(`
        CREATE OR REPLACE FUNCTION public.comment_embedding_input_wrapper(post_record jsonb)
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          result jsonb;
        BEGIN
          -- The edge function passes record_id inside post_record as {id: "the_id"}
          -- Call the original function with the post_record 
          result := public.comment_embedding_input(post_record);
          RETURN result;
        END;
        $$;
      `);
      console.log('✅ Created wrapper function for comment_embedding_input');
    }
    
    // Step 2: Update failed queue items to use the wrapper functions
    console.log('\n🔄 Updating failed queue items to use wrapper functions...');
    
    // Update update_comment_embedding to use wrapper
    const updateCommentResult = await pool.query(`
      UPDATE util.embedding_queue
      SET 
        status = 'pending',
        content_function = 'update_comment_embedding_wrapper',
        attempts = 0,
        last_error = NULL,
        processed_at = NULL
      WHERE 
        status = 'failed' 
        AND content_function = 'update_comment_embedding'
      RETURNING id;
    `);
    
    console.log(`✅ Updated ${updateCommentResult.rowCount} failed items to use update_comment_embedding_wrapper`);
    
    // Update update_post_embedding to use wrapper
    const updatePostResult = await pool.query(`
      UPDATE util.embedding_queue
      SET 
        status = 'pending',
        content_function = 'update_post_embedding_wrapper',
        attempts = 0,
        last_error = NULL,
        processed_at = NULL
      WHERE 
        status = 'failed' 
        AND content_function = 'update_post_embedding'
      RETURNING id;
    `);
    
    console.log(`✅ Updated ${updatePostResult.rowCount} failed items to use update_post_embedding_wrapper`);
    
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
    
    console.log('\n📋 SQL to create missing functions if needed (you can run this manually):');
    console.log(`
CREATE OR REPLACE FUNCTION public.get_comment_content_for_embedding(post_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simply redirect to the correct function with compatible parameters
  RETURN public.get_comment_content(post_record);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_post_content_for_embedding(post_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simply redirect to the correct function with compatible parameters
  RETURN public.get_post_content(post_record);
END;
$$;
    `);
    
    console.log('\n📋 Next steps:');
    console.log('1. Continue processing the queue with the fixed function parameters:');
    console.log('   npx ts-node process-all-queue.ts');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
fixQueueParameters(); 