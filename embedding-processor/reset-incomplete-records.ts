// reset-incomplete-records.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create PostgreSQL pool for direct database access
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetIncompleteRecords() {
  console.log('==== RESETTING INCOMPLETE RECORDS WITH MISSING METADATA ====');
  console.log('This script will reset the status of completed records that have missing metadata fields due to rate limiting.');
  
  const client = await pgPool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // 1. Reset posts with missing metadata
    const postsResult = await client.query(`
      UPDATE util.embedding_queue eq
      SET 
        status = 'pending',
        attempts = 0,
        processed_at = NULL,
        last_error = NULL
      FROM reddit_posts rp
      WHERE eq.record_id = rp.id
        AND eq.status = 'completed'
        AND eq.table_name = 'reddit_posts'
        AND (
          rp.extracted_topics = '{}' OR 
          rp.extracted_entities = '{}' OR 
          rp.semantic_tags = '{}'
        )
      RETURNING eq.id, eq.record_id
    `);
    
    const postsResetCount = postsResult.rowCount || 0;
    console.log(`Reset ${postsResetCount} posts from 'completed' to 'pending'`);
    
    // 2. Reset comments with missing metadata
    const commentsResult = await client.query(`
      UPDATE util.embedding_queue eq
      SET 
        status = 'pending',
        attempts = 0,
        processed_at = NULL,
        last_error = NULL
      FROM reddit_comments rc
      WHERE eq.record_id = rc.id
        AND eq.status = 'completed'
        AND eq.table_name = 'reddit_comments'
        AND (
          rc.extracted_topics = '{}' OR 
          rc.extracted_entities = '{}'
        )
      RETURNING eq.id, eq.record_id
    `);
    
    const commentsResetCount = commentsResult.rowCount || 0;
    console.log(`Reset ${commentsResetCount} comments from 'completed' to 'pending'`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`Total records reset: ${postsResetCount + commentsResetCount}`);
    console.log('Records have been reset to "pending" and will be picked up by the processor');
    
    // Get current queue stats
    const statsResult = await client.query(`
      SELECT status, COUNT(*) 
      FROM util.embedding_queue 
      GROUP BY status
      ORDER BY COUNT(*) DESC
    `);
    
    console.log('\nCurrent queue stats:');
    statsResult.rows.forEach(row => {
      console.log(`- ${row.status}: ${row.count}`);
    });
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error resetting incomplete records:', error);
  } finally {
    client.release();
    await pgPool.end();
  }
}

// Run the function
resetIncompleteRecords().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 