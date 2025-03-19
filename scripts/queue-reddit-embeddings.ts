import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Supabase client with schema setting
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    }
  }
);

console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Service role key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Queue Reddit posts for enhanced embeddings
 */
async function queuePostsForEmbeddings(limit: number = 100, subreddit: string = 'AskSF'): Promise<void> {
  try {
    console.log(`Queuing up to ${limit} Reddit posts from r/${subreddit} for embedding...`);
    
    // Get posts without embeddings
    const { data: posts, error } = await supabase
      .from('reddit_posts')
      .select('id, title')
      .eq('subreddit', subreddit)
      .is('embedding', null)
      .limit(limit);
    
    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }
    
    console.log(`Found ${posts?.length || 0} posts without embeddings`);
    
    // Queue each post for embedding generation
    let successCount = 0;
    for (const post of posts || []) {
      try {
        // Add to the embedding queue with high priority
        const { data, error: queueError } = await supabase.rpc('add_to_embedding_queue', {
          record_id_param: post.id,
          schema_name_param: 'public',
          table_name_param: 'reddit_posts',
          content_function_param: 'post_embedding_input',
          embedding_column_param: 'embedding',
          priority_param: 100, // High priority
          subreddit_param: subreddit
        });
        
        if (queueError) {
          console.error(`Error queuing post ${post.id} for embedding:`, queueError);
        } else {
          successCount++;
          console.log(`Queued post: ${post.title.substring(0, 30)}...`);
        }
      } catch (err) {
        console.error(`Error processing post ${post.id}:`, err);
      }
    }
    
    console.log(`Successfully queued ${successCount} posts for embedding generation`);
  } catch (error) {
    console.error('Error in queuePostsForEmbeddings:', error);
  }
}

/**
 * Queue Reddit comments for enhanced embeddings
 */
async function queueCommentsForEmbeddings(limit: number = 500): Promise<void> {
  try {
    console.log(`Queuing up to ${limit} Reddit comments for embedding...`);
    
    // Get comments without embeddings
    const { data: comments, error } = await supabase
      .from('reddit_comments')
      .select('id, content')
      .is('embedding', null)
      .limit(limit);
    
    if (error) {
      console.error('Error fetching comments:', error);
      return;
    }
    
    console.log(`Found ${comments?.length || 0} comments without embeddings`);
    
    // Queue each comment for embedding generation
    let successCount = 0;
    for (const comment of comments || []) {
      try {
        // Add to the embedding queue with normal priority
        const { data, error: queueError } = await supabase.rpc('add_to_embedding_queue', {
          record_id_param: comment.id,
          schema_name_param: 'public',
          table_name_param: 'reddit_comments',
          content_function_param: 'comment_embedding_input',
          embedding_column_param: 'embedding',
          priority_param: 50, // Normal priority
          subreddit_param: null
        });
        
        if (queueError) {
          console.error(`Error queuing comment ${comment.id} for embedding:`, queueError);
        } else {
          successCount++;
          console.log(`Queued comment: ${comment.content.substring(0, 30)}...`);
        }
      } catch (err) {
        console.error(`Error processing comment ${comment.id}:`, err);
      }
    }
    
    console.log(`Successfully queued ${successCount} comments for embedding generation`);
  } catch (error) {
    console.error('Error in queueCommentsForEmbeddings:', error);
  }
}

/**
 * Check embedding queue status
 */
async function checkEmbeddingQueueStatus(): Promise<void> {
  try {
    console.log('Checking embedding queue status...');
    
    // Get queue stats - using the correct function name
    const { data: stats, error } = await supabase.rpc('get_embedding_queue_stats');
    
    if (error) {
      console.error('Error fetching queue stats:', error);
      return;
    }
    
    console.log('Embedding Queue Stats:');
    console.log(JSON.stringify(stats, null, 2));
    
    // Get recent queue items
    const { data: recentItems, error: recentError } = await supabase
      .from('util.embedding_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentError) {
      console.error('Error fetching recent queue items:', recentError);
    } else {
      console.log('\nMost Recent Queue Items:');
      console.log(JSON.stringify(recentItems, null, 2));
    }
  } catch (error) {
    console.error('Error in checkEmbeddingQueueStatus:', error);
  }
}

/**
 * Main function to queue embeddings and check status
 */
async function main(): Promise<void> {
  try {
    // Queue posts for embeddings
    await queuePostsForEmbeddings();
    
    // Queue comments for embeddings
    await queueCommentsForEmbeddings();
    
    // Check queue status
    await checkEmbeddingQueueStatus();
    
    console.log('Done! The embedding system will process these items in the background.');
    console.log('You can check progress by running this script again with the --status flag');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Check if we're only checking status
const args = process.argv.slice(2);
if (args.includes('--status')) {
  checkEmbeddingQueueStatus()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
} else {
  // Run the main function
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
} 