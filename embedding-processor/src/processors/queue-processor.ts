// src/processors/queue-processor.ts
import { supabase } from '../services/supabase';
import { processContentItem } from './content-processor';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Default batch size
const DEFAULT_BATCH_SIZE = 10;

// Initialize PostgreSQL pool for direct database access
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Process a batch of items from the queue
 */
export async function processQueue(
  batchSize = Number(process.env.BATCH_SIZE || DEFAULT_BATCH_SIZE)
) {
  try {
    console.log(`Starting to process queue with batch size ${batchSize}`);
    
    // Connect to the database directly to access util schema
    const client = await pgPool.connect();
    
    try {
      // Get pending queue items
      const queueResult = await client.query(`
        SELECT * FROM util.embedding_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT $1
      `, [batchSize]);
      
      const queueItems = queueResult.rows;
      
      if (!queueItems || queueItems.length === 0) {
        console.log('No pending items in queue');
        return { processed: 0, queueItems: [] };
      }
      
      console.log(`Found ${queueItems.length} pending items to process`);
      let processed = 0;
      const results = [];
      
      // Process each item
      for (const item of queueItems) {
        try {
          // Mark as processing
          await client.query(`
            UPDATE util.embedding_queue
            SET 
              status = 'processing',
              processed_at = NOW()
            WHERE id = $1
          `, [item.id]);
            
          // Process the item based on table_name (post or comment)
          const contentType = item.table_name.includes('post') ? 'post' : 'comment';
          await processContentItem(item.record_id, contentType);
          
          // Mark as completed
          await client.query(`
            UPDATE util.embedding_queue
            SET 
              status = 'completed',
              processed_at = NOW()
            WHERE id = $1
          `, [item.id]);
            
          results.push({
            id: item.id,
            record_id: item.record_id,
            table_name: item.table_name,
            success: true
          });
          
          processed++;
          console.log(`Successfully processed ${contentType} ${item.record_id}`);
        } catch (error: any) {
          console.error(`Error processing ${item.table_name} ${item.record_id}:`, error);
          
          // Mark as failed
          await client.query(`
            UPDATE util.embedding_queue
            SET 
              status = 'failed',
              last_error = $2,
              attempts = attempts + 1
            WHERE id = $1
          `, [item.id, error.message || String(error)]);
            
          results.push({
            id: item.id,
            record_id: item.record_id,
            table_name: item.table_name,
            success: false,
            error: error.message || String(error)
          });
        }
        
        // Small delay between items to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      
      // Get current queue statistics
      const statsResult = await client.query(`
        SELECT 
          status, 
          COUNT(*) as count
        FROM util.embedding_queue 
        GROUP BY status
      `);
      
      const queueStats = statsResult.rows.reduce((acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {});
      
      console.log(`Processed ${processed} items successfully.`);
      console.log('Current queue status:', queueStats);
      
      return { processed, results, queueStats };
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in queue processing:', error);
    throw new Error(`Queue processing error: ${error.message}`);
  }
} 