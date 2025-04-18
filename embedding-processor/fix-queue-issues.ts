// fix-queue-issues.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create PostgreSQL pool for direct database access
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixQueueIssues() {
  console.log('==== FIXING QUEUE ISSUES ====');
  console.log('This script will:');
  console.log('1. Remove duplicate entries from the embedding queue');
  console.log('2. Reset any completed records with empty metadata to pending status');
  
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Step 1: Get stats before cleanup
    console.log('\n== CURRENT QUEUE STATS BEFORE CLEANUP ==');
    const beforeStats = await client.query(`
      SELECT status, COUNT(*) 
      FROM util.embedding_queue 
      GROUP BY status
      ORDER BY COUNT(*) DESC
    `);
    
    console.log('Queue status before cleanup:');
    beforeStats.rows.forEach(row => {
      console.log(`- ${row.status}: ${row.count}`);
    });
    
    console.log('\n== METADATA ISSUES BEFORE CLEANUP ==');
    
    const beforeMetadataStats = await client.query(`
      SELECT 
        'posts' as type,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND rp.extracted_topics = '{}') as empty_topics,
        COUNT(*) FILTER (WHERE status = 'completed' AND rp.extracted_entities = '{}') as empty_entities,
        COUNT(*) FILTER (WHERE status = 'completed' AND rp.semantic_tags = '{}') as empty_semantic_tags
      FROM util.embedding_queue eq
      JOIN reddit_posts rp ON eq.record_id = rp.id
      WHERE eq.table_name = 'reddit_posts'
      UNION ALL
      SELECT 
        'comments' as type,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND rc.extracted_topics = '{}') as empty_topics,
        COUNT(*) FILTER (WHERE status = 'completed' AND rc.extracted_entities = '{}') as empty_entities,
        COUNT(*) FILTER (WHERE status = 'completed' AND (rc.thread_context IS NULL OR rc.thread_context = '{}')) as empty_semantic_tags
      FROM util.embedding_queue eq
      JOIN reddit_comments rc ON eq.record_id = rc.id
      WHERE eq.table_name = 'reddit_comments'
    `);
    
    console.log('Metadata issues before cleanup:');
    beforeMetadataStats.rows.forEach(row => {
      console.log(`- ${row.type}: ${row.completed_count} completed, ${row.empty_topics} with empty topics, ${row.empty_entities} with empty entities, ${row.empty_semantic_tags} with empty semantic tags`);
    });
    
    console.log('\n== DUPLICATE ENTRIES BEFORE CLEANUP ==');
    const duplicatesResult = await client.query(`
      SELECT COUNT(*) as total_records_with_duplicates
      FROM (
        SELECT record_id, table_name
        FROM util.embedding_queue
        GROUP BY record_id, table_name
        HAVING COUNT(*) > 1
      ) as duplicates
    `);
    
    console.log(`Records with duplicate entries: ${duplicatesResult.rows[0].total_records_with_duplicates}`);
    
    // Step 2: Clean up duplicate entries
    console.log('\n== CLEANING UP DUPLICATE ENTRIES ==');
    
    // First identify duplicates to keep - prioritize completed entries with metadata
    await client.query(`
      CREATE TEMP TABLE entries_to_keep AS
      WITH ranked_entries AS (
        SELECT
          eq.id,
          eq.record_id,
          eq.table_name,
          eq.status,
          CASE
            WHEN eq.table_name = 'reddit_posts' AND eq.status = 'completed' AND EXISTS (
              SELECT 1 FROM reddit_posts p 
              WHERE p.id = eq.record_id 
              AND p.extracted_topics IS NOT NULL AND p.extracted_topics != '{}'
              AND p.extracted_entities IS NOT NULL AND p.extracted_entities != '{}'
              AND p.semantic_tags IS NOT NULL AND p.semantic_tags != '{}'
            ) THEN 1
            WHEN eq.table_name = 'reddit_comments' AND eq.status = 'completed' AND EXISTS (
              SELECT 1 FROM reddit_comments c 
              WHERE c.id = eq.record_id 
              AND c.extracted_topics IS NOT NULL AND c.extracted_topics != '{}'
              AND c.extracted_entities IS NOT NULL AND c.extracted_entities != '{}'
            ) THEN 1
            WHEN eq.status = 'pending' THEN 2
            ELSE 3
          END AS priority,
          ROW_NUMBER() OVER (
            PARTITION BY eq.record_id, eq.table_name 
            ORDER BY 
              CASE
                WHEN eq.table_name = 'reddit_posts' AND eq.status = 'completed' AND EXISTS (
                  SELECT 1 FROM reddit_posts p 
                  WHERE p.id = eq.record_id 
                  AND p.extracted_topics IS NOT NULL AND p.extracted_topics != '{}'
                  AND p.extracted_entities IS NOT NULL AND p.extracted_entities != '{}'
                  AND p.semantic_tags IS NOT NULL AND p.semantic_tags != '{}'
                ) THEN 1
                WHEN eq.table_name = 'reddit_comments' AND eq.status = 'completed' AND EXISTS (
                  SELECT 1 FROM reddit_comments c 
                  WHERE c.id = eq.record_id 
                  AND c.extracted_topics IS NOT NULL AND c.extracted_topics != '{}'
                  AND c.extracted_entities IS NOT NULL AND c.extracted_entities != '{}'
                ) THEN 1
                WHEN eq.status = 'pending' THEN 2
                ELSE 3
              END ASC,
              eq.created_at ASC
          ) AS row_num
        FROM util.embedding_queue eq
      )
      SELECT id
      FROM ranked_entries
      WHERE row_num = 1
    `);
    
    // Delete entries that are not in the keep list
    const deleteResult = await client.query(`
      DELETE FROM util.embedding_queue
      WHERE id NOT IN (SELECT id FROM entries_to_keep)
      RETURNING id
    `);
    
    console.log(`Removed ${deleteResult.rowCount} duplicate queue entries`);
    
    // Drop the temporary table
    await client.query('DROP TABLE entries_to_keep');
    
    // Step 3: Reset completed entries with empty metadata to pending
    console.log('\n== RESETTING COMPLETED ENTRIES WITH EMPTY METADATA ==');
    
    // Reset posts with any empty metadata fields
    const postsResetResult = await client.query(`
      UPDATE util.embedding_queue eq
      SET 
        status = 'pending',
        attempts = 0,
        processed_at = NULL,
        last_error = NULL
      FROM reddit_posts p
      WHERE eq.record_id = p.id
        AND eq.status = 'completed'
        AND eq.table_name = 'reddit_posts'
        AND (
          p.extracted_topics IS NULL OR p.extracted_topics = '{}'
          OR p.extracted_entities IS NULL OR p.extracted_entities = '{}'
          OR p.semantic_tags IS NULL OR p.semantic_tags = '{}'
          OR p.extracted_locations IS NULL OR p.extracted_locations = '{}'
        )
      RETURNING eq.id
    `);
    
    console.log(`Reset ${postsResetResult.rowCount} posts with incomplete metadata back to pending status`);
    
    // Reset comments with any empty metadata fields
    const commentsResetResult = await client.query(`
      UPDATE util.embedding_queue eq
      SET 
        status = 'pending',
        attempts = 0,
        processed_at = NULL,
        last_error = NULL
      FROM reddit_comments c
      WHERE eq.record_id = c.id
        AND eq.status = 'completed'
        AND eq.table_name = 'reddit_comments'
        AND (
          c.extracted_topics IS NULL OR c.extracted_topics = '{}'
          OR c.extracted_entities IS NULL OR c.extracted_entities = '{}'
        )
      RETURNING eq.id
    `);
    
    console.log(`Reset ${commentsResetResult.rowCount} comments with incomplete metadata back to pending status`);
    
    // Step 4: Get stats after cleanup
    console.log('\n== QUEUE STATS AFTER CLEANUP ==');
    const afterStats = await client.query(`
      SELECT status, COUNT(*) 
      FROM util.embedding_queue 
      GROUP BY status
      ORDER BY COUNT(*) DESC
    `);
    
    console.log('Queue status after cleanup:');
    afterStats.rows.forEach(row => {
      console.log(`- ${row.status}: ${row.count}`);
    });
    
    // Step 5: Check for any remaining duplicate entries
    const remainingDuplicatesResult = await client.query(`
      SELECT COUNT(*) as total_records_with_duplicates
      FROM (
        SELECT record_id, table_name
        FROM util.embedding_queue
        GROUP BY record_id, table_name
        HAVING COUNT(*) > 1
      ) as duplicates
    `);
    
    console.log(`\nRemaining records with duplicate entries: ${remainingDuplicatesResult.rows[0].total_records_with_duplicates}`);
    
    // Commit all changes
    await client.query('COMMIT');
    
    console.log('\n==== CLEANUP COMPLETED SUCCESSFULLY ====');
    console.log('You can now run the processors again to handle the pending items');
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error fixing queue issues:', error);
  } finally {
    client.release();
    await pgPool.end();
  }
}

// Run the function
fixQueueIssues().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 