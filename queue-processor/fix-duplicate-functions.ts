// fix-duplicate-functions.ts
// Script to fix the duplicate function problem
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function fixDuplicateFunctions() {
  try {
    console.log('🔍 Fixing duplicate function problem...');
    
    // Drop all wrapper functions to clean up
    console.log('\n🧹 Dropping existing wrapper functions...');
    
    await pool.query(`DROP FUNCTION IF EXISTS public.update_comment_embedding_wrapper(jsonb);`);
    console.log('✅ Dropped update_comment_embedding_wrapper(jsonb)');
    
    await pool.query(`DROP FUNCTION IF EXISTS public.update_comment_embedding_wrapper(json);`);
    console.log('✅ Dropped update_comment_embedding_wrapper(json)');
    
    await pool.query(`DROP FUNCTION IF EXISTS public.update_post_embedding_wrapper(jsonb);`);
    console.log('✅ Dropped update_post_embedding_wrapper(jsonb)');
    
    await pool.query(`DROP FUNCTION IF EXISTS public.update_post_embedding_wrapper(json);`);
    console.log('✅ Dropped update_post_embedding_wrapper(json)');
    
    await pool.query(`DROP FUNCTION IF EXISTS public.comment_embedding_input_wrapper(jsonb);`);
    console.log('✅ Dropped comment_embedding_input_wrapper(jsonb)');
    
    await pool.query(`DROP FUNCTION IF EXISTS public.comment_embedding_input_wrapper(json);`);
    console.log('✅ Dropped comment_embedding_input_wrapper(json)');
    
    // Create new simplified wrapper functions
    console.log('\n🔧 Creating new simplified wrapper functions...');
    
    // Create a simple function that ONLY returns content as text
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.update_comment_embedding_wrapper(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        comment_content text;
      BEGIN
        -- Get the content (this is what the edge function expects)
        SELECT content INTO comment_content
        FROM reddit_comments 
        WHERE id = (post_record->>'id')::text;
        
        -- This is separate - actually do the embedding update
        -- But don't make the return value depend on this
        PERFORM public.update_comment_embedding(
          (post_record->>'id')::text,
          NULL::double precision[]
        );
        
        -- Return content as text
        RETURN comment_content;
      END;
      $$;
    `);
    console.log('✅ Created simplified update_comment_embedding_wrapper(json)');
    
    // Create get_comment_content_for_embedding as a simple alias
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.get_comment_content_for_embedding(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        comment_content text;
      BEGIN
        -- Just get the content
        SELECT content INTO comment_content
        FROM reddit_comments 
        WHERE id = (post_record->>'id')::text;
        
        -- Return content as text
        RETURN comment_content;
      END;
      $$;
    `);
    console.log('✅ Created get_comment_content_for_embedding(json)');
    
    // Create get_post_content_for_embedding function
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.get_post_content_for_embedding(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        post_content text;
      BEGIN
        -- Just get the content
        SELECT content INTO post_content
        FROM reddit_posts 
        WHERE id = (post_record->>'id')::text;
        
        -- Return content as text
        RETURN post_content;
      END;
      $$;
    `);
    console.log('✅ Created get_post_content_for_embedding(json)');
    
    // Create a simple update_post_embedding_wrapper
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.update_post_embedding_wrapper(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        post_content text;
      BEGIN
        -- Get the content
        SELECT content INTO post_content
        FROM reddit_posts 
        WHERE id = (post_record->>'id')::text;
        
        -- This is separate - actually do the embedding update
        -- But don't make the return value depend on this
        PERFORM public.update_post_embedding(
          (post_record->>'id')::text,
          NULL::double precision[]
        );
        
        -- Return content as text
        RETURN post_content;
      END;
      $$;
    `);
    console.log('✅ Created simplified update_post_embedding_wrapper(json)');
    
    // Reset failed records to try again
    const resetResult = await pool.query(`
      UPDATE util.embedding_queue
      SET 
        status = 'pending',
        attempts = 0,
        last_error = NULL,
        processed_at = NULL
      WHERE 
        status = 'failed'
        AND last_error LIKE '%Could not choose the best candidate function%'
      RETURNING id;
    `);
    
    console.log(`\n✅ Reset ${resetResult.rowCount} failed items with 'Could not choose the best candidate function' error`);
    
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
    console.log('1. Continue processing the queue with the fixed wrapper functions:');
    console.log('   npx ts-node process-all-queue.ts');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
fixDuplicateFunctions(); 