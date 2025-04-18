// src/cli.ts
import { processQueue } from './processors/queue-processor';
import { processContentItem } from './processors/content-processor';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

dotenv.config();

// Create Supabase client with admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Create PostgreSQL pool for direct database access
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const args = process.argv.slice(2);
const command = args[0];

async function runCommand() {
  try {
    switch (command) {
      case 'process-queue':
        const batchSize = args[1] ? parseInt(args[1]) : undefined;
        const result = await processQueue(batchSize);
        console.log(`Processed ${result.processed} items`);
        console.log('Queue stats:', result.queueStats);
        break;
        
      case 'process-item':
        const contentId = args[1];
        const contentType = args[2] as 'post' | 'comment';
        
        if (!contentId || !contentType) {
          console.error('Usage: npm run cli process-item <content_id> <post|comment>');
          process.exit(1);
        }
        
        if (contentType !== 'post' && contentType !== 'comment') {
          console.error('Content type must be either "post" or "comment"');
          process.exit(1);
        }
        
        await processContentItem(contentId, contentType);
        console.log(`Successfully processed ${contentType} ${contentId}`);
        break;
        
      case 'populate-queue':
        await populateQueue();
        break;
        
      case 'clear-queue':
        await clearQueue();
        break;
        
      case 'reset-queue':
        await resetQueue();
        break;
        
      default:
        console.error('Unknown command. Available commands: process-queue, process-item, populate-queue, clear-queue, reset-queue');
        process.exit(1);
    }
    
    // Close the database connection pool
    await pgPool.end();
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    // Close the database connection pool on error
    await pgPool.end();
    process.exit(1);
  }
}

async function populateQueue() {
  console.log('Populating embedding queue with all posts and comments...');
  
  try {
    // Get all post IDs
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('id, subreddit');
    
    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`);
    }
    
    console.log(`Found ${posts?.length || 0} posts to process`);
    
    // Queue posts in batches using direct SQL insertion instead of function call
    const BATCH_SIZE = 20; // Process in smaller batches
    let successCount = 0;
    
    const client = await pgPool.connect();
    
    try {
      for (let i = 0; i < posts?.length; i += BATCH_SIZE) {
        const batch = posts.slice(i, i + BATCH_SIZE);
        let batchSuccesses = 0;
        
        // Process each post in the batch
        for (const post of batch) {
          try {
            // Direct insertion with explicit type casts for PostgreSQL
            await client.query(`
              INSERT INTO util.embedding_queue
              (record_id, schema_name, table_name, content_function, embedding_column, status, priority, subreddit, estimated_tokens)
              VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, 'pending', $6::smallint, $7::text, $8::integer)
            `, [
              post.id,                // record_id
              'public',               // schema_name
              'reddit_posts',         // table_name
              'get_post_content',     // content_function
              'search_vector',        // embedding_column
              5,                      // priority
              post.subreddit,         // subreddit (as text)
              null                    // estimated_tokens
            ]);
            batchSuccesses++;
          } catch (error: any) {
            console.error(`Error queueing post ${post.id}: ${error.message}`);
          }
        }
        
        successCount += batchSuccesses;
        console.log(`Queued ${i + batch.length}/${posts.length} posts (${batchSuccesses} successful)`);
      }
    } finally {
      client.release();
    }
    
    console.log(`Successfully queued ${successCount}/${posts?.length || 0} posts`);
    
    // Get all comment IDs
    const { data: comments, error: commentsError } = await supabase
      .from('reddit_comments')
      .select('id');
    
    if (commentsError) {
      throw new Error(`Error fetching comments: ${commentsError.message}`);
    }
    
    console.log(`Found ${comments?.length || 0} comments to process`);
    
    // Queue comments in batches
    let commentSuccessCount = 0;
    const commentClient = await pgPool.connect();
    
    try {
      for (let i = 0; i < comments?.length; i += BATCH_SIZE) {
        const batch = comments.slice(i, i + BATCH_SIZE);
        let batchSuccesses = 0;
        
        // Process each comment in the batch
        for (const comment of batch) {
          try {
            // Direct insertion with explicit type casts for PostgreSQL
            await commentClient.query(`
              INSERT INTO util.embedding_queue
              (record_id, schema_name, table_name, content_function, embedding_column, status, priority)
              VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, 'pending', $6::smallint)
            `, [
              comment.id,             // record_id
              'public',               // schema_name
              'reddit_comments',      // table_name
              'get_comment_content',  // content_function
              'search_vector',        // embedding_column
              3                       // priority
            ]);
            batchSuccesses++;
          } catch (error: any) {
            console.error(`Error queueing comment ${comment.id}: ${error.message}`);
          }
        }
        
        commentSuccessCount += batchSuccesses;
        console.log(`Queued ${i + batch.length}/${comments.length} comments (${batchSuccesses} successful)`);
      }
    } finally {
      commentClient.release();
    }
    
    console.log(`Successfully queued ${commentSuccessCount}/${comments?.length || 0} comments`);
    
    // Get queue stats
    const statsClient = await pgPool.connect();
    try {
      const queueStats = await statsClient.query(`
        SELECT status, COUNT(*) 
        FROM util.embedding_queue 
        GROUP BY status
      `);
      
      console.log('Queue populated successfully!');
      console.log('Current queue status:');
      queueStats.rows.forEach(row => {
        console.log(`- ${row.status}: ${row.count}`);
      });
    } catch (error: any) {
      console.error(`Error getting queue stats: ${error.message}`);
    } finally {
      statsClient.release();
    }
    
  } catch (error: any) {
    console.error('Failed to populate queue:', error.message);
    throw error;
  }
}

async function clearQueue() {
  console.log('Clearing embedding queue (pending/processing items only)...');
  
  try {
    const client = await pgPool.connect();
    
    try {
      // Direct query using PostgreSQL
      const result = await client.query(
        'DELETE FROM util.embedding_queue WHERE status IN ($1, $2) RETURNING id',
        ['pending', 'processing']
      );
      
      const deletedCount = result.rowCount;
      console.log(`Queue cleared successfully! Removed ${deletedCount} pending/processing items.`);
      
      // Get counts of remaining items by status
      const statsResult = await client.query(`
        SELECT status, COUNT(*) 
        FROM util.embedding_queue 
        GROUP BY status
      `);
      
      console.log('Current queue status:');
      statsResult.rows.forEach(row => {
        console.log(`- ${row.status}: ${row.count}`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('Failed to clear queue:', error.message);
    throw error;
  }
}

async function resetQueue() {
  console.log('Resetting all items in the embedding queue to pending status...');
  
  try {
    const client = await pgPool.connect();
    
    try {
      // Reset all completed, failed, and processing items to pending
      const { rowCount } = await client.query(`
        UPDATE util.embedding_queue 
        SET 
          status = 'pending',
          attempts = 0,
          last_error = NULL,
          processed_at = NULL
        WHERE status IN ('completed', 'failed', 'processing')
      `);
      
      console.log(`Reset ${rowCount} items to pending status.`);
      
      // Get current queue stats
      const queueStats = await client.query(`
        SELECT status, COUNT(*) 
        FROM util.embedding_queue 
        GROUP BY status
      `);
      
      console.log('Current queue status:');
      queueStats.rows.forEach(row => {
        console.log(`- ${row.status}: ${row.count}`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('Failed to reset queue:', error.message);
    throw error;
  }
}

runCommand(); 