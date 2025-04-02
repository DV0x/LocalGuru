// fix-wrapper-return-type.ts
// Script to update wrapper functions to return string content
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function fixWrapperReturnType() {
  try {
    console.log('🔍 Fixing wrapper functions to return string content...');
    
    // First, get a comment from the database to understand its structure
    const commentResult = await pool.query(`
      SELECT content
      FROM reddit_comments
      WHERE id = (
        SELECT record_id 
        FROM util.embedding_queue 
        WHERE status = 'failed' AND table_name = 'reddit_comments'
        LIMIT 1
      )
      LIMIT 1;
    `);
    
    const sampleCommentContent = commentResult.rows[0]?.content || 'Sample content for testing';
    console.log(`\n📝 Sample comment content: "${sampleCommentContent.substring(0, 50)}..."`);
    
    // Update wrapper functions to return text content
    console.log('\n🔧 Updating wrapper functions to return a string...');
    
    // Update update_comment_embedding_wrapper to return content
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.update_comment_embedding_wrapper(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        comment_content text;
      BEGIN
        -- Get the comment ID from the post_record
        -- Fetch the actual comment content from the database
        SELECT c.content INTO comment_content
        FROM reddit_comments c
        WHERE c.id = (post_record->>'id')::text;
        
        -- Call update_comment_embedding with the extracted ID
        -- This performs the actual embedding update
        PERFORM public.update_comment_embedding(
          (post_record->>'id')::text,
          NULL::double precision[]
        );
        
        -- Return the comment content as text for process-queue
        RETURN comment_content;
      END;
      $$;
    `);
    console.log('✅ Updated update_comment_embedding_wrapper to return comment content');
    
    // Update update_post_embedding_wrapper to return content
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.update_post_embedding_wrapper(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        post_content text;
      BEGIN
        -- Get the post ID from the post_record
        -- Fetch the actual post content from the database
        SELECT p.content INTO post_content
        FROM reddit_posts p
        WHERE p.id = (post_record->>'id')::text;
        
        -- Call update_post_embedding with the extracted ID
        -- This performs the actual embedding update
        PERFORM public.update_post_embedding(
          (post_record->>'id')::text,
          NULL::double precision[]
        );
        
        -- Return the post content as text for process-queue
        RETURN post_content;
      END;
      $$;
    `);
    console.log('✅ Updated update_post_embedding_wrapper to return post content');
    
    // Create a get_comment_content_for_embedding function that returns content
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.get_comment_content_for_embedding(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        comment_content text;
      BEGIN
        -- Get the comment ID from the post_record
        -- Fetch the actual comment content from the database
        SELECT c.content INTO comment_content
        FROM reddit_comments c
        WHERE c.id = (post_record->>'id')::text;
        
        -- Return the comment content as text for process-queue
        RETURN comment_content;
      END;
      $$;
    `);
    console.log('✅ Created get_comment_content_for_embedding to return comment content');
    
    // For completeness, create a get_post_content_for_embedding function that returns content
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.get_post_content_for_embedding(post_record json)
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        post_content text;
      BEGIN
        -- Get the post ID from the post_record
        -- Fetch the actual post content from the database
        SELECT p.content INTO post_content
        FROM reddit_posts p
        WHERE p.id = (post_record->>'id')::text;
        
        -- Return the post content as text for process-queue
        RETURN post_content;
      END;
      $$;
    `);
    console.log('✅ Created get_post_content_for_embedding to return post content');
    
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
        AND last_error LIKE '%content.substring is not a function%'
      RETURNING id;
    `);
    
    console.log(`\n✅ Reset ${resetResult.rowCount} failed items with 'substring is not a function' error`);
    
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
    console.log('1. Continue processing the queue with the fixed function return types:');
    console.log('   npx ts-node process-all-queue.ts');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
fixWrapperReturnType(); 