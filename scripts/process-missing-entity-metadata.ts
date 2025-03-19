// Script to process content that's missing entity metadata
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Processing configuration
const BATCH_SIZE = 10; // Process this many items at a time
const DELAY_BETWEEN_BATCHES_MS = 5000; // Wait this long between batches to avoid rate limits
const MAX_ITEMS_TO_PROCESS = 50; // Maximum number of items to process in a single run

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Queue content for processing by the enhanced-embeddings edge function
async function queueForEnhancedProcessing(contentId: string, contentType: 'post' | 'comment') {
  try {
    console.log(`Invoking enhanced-embeddings function for ${contentType} ${contentId}`);
    
    // Make a curl request to the Supabase edge function
    const curlCommand = `curl -X POST "${process.env.SUPABASE_URL}/functions/v1/enhanced-embeddings" \\
      -H "Authorization: Bearer ${process.env.SUPABASE_ANON_KEY}" \\
      -H "Content-Type: application/json" \\
      -d '{"contentId": "${contentId}", "contentType": "${contentType}", "includeContext": true}'`;
    
    // Execute the curl command
    try {
      execSync(curlCommand, { stdio: 'pipe' });
      console.log(`Successfully queued ${contentType} ${contentId}`);
      return true;
    } catch (execError) {
      console.error(`Error executing curl command for ${contentType} ${contentId}:`, execError);
      return false;
    }
  } catch (error) {
    console.error(`Error queuing ${contentType} ${contentId}:`, error);
    return false;
  }
}

// Process posts missing entity metadata
async function processMissingPostEntityMetadata() {
  console.log("Finding posts missing entity metadata...");
  
  try {
    // Find posts missing entity metadata
    const { data: posts, error } = await supabase
      .from('reddit_posts')
      .select('id, title, subreddit')
      .or('extracted_entities.is.null,extracted_topics.is.null,semantic_tags.is.null')
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS_TO_PROCESS);
    
    if (error) {
      throw error;
    }
    
    if (!posts || posts.length === 0) {
      console.log("No posts found missing entity metadata");
      return;
    }
    
    console.log(`Found ${posts.length} posts missing entity metadata`);
    
    // Process in batches
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batchPosts = posts.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(posts.length/BATCH_SIZE)} (${batchPosts.length} posts)`);
      
      // Process each post in the batch
      for (const post of batchPosts) {
        console.log(`Queueing post: ${post.title} (${post.id})`);
        await queueForEnhancedProcessing(post.id, 'post');
      }
      
      // Wait between batches to avoid rate limits
      if (i + BATCH_SIZE < posts.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS/1000} seconds before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }
    
    console.log("\nCompleted queueing posts for entity extraction");
  } catch (error) {
    console.error("Error processing posts:", error);
  }
}

// Process comments missing entity metadata
async function processMissingCommentEntityMetadata() {
  console.log("\nFinding comments missing entity metadata...");
  
  try {
    // Find comments missing entity metadata
    const { data: comments, error } = await supabase
      .from('reddit_comments')
      .select('id, content, post_id')
      .or('extracted_entities.is.null,extracted_topics.is.null')
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS_TO_PROCESS);
    
    if (error) {
      throw error;
    }
    
    if (!comments || comments.length === 0) {
      console.log("No comments found missing entity metadata");
      return;
    }
    
    console.log(`Found ${comments.length} comments missing entity metadata`);
    
    // Process in batches
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batchComments = comments.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(comments.length/BATCH_SIZE)} (${batchComments.length} comments)`);
      
      // Process each comment in the batch
      for (const comment of batchComments) {
        console.log(`Queueing comment: ${comment.id} (post: ${comment.post_id})`);
        await queueForEnhancedProcessing(comment.id, 'comment');
      }
      
      // Wait between batches to avoid rate limits
      if (i + BATCH_SIZE < comments.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS/1000} seconds before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }
    
    console.log("\nCompleted queueing comments for entity extraction");
  } catch (error) {
    console.error("Error processing comments:", error);
  }
}

// Main function
async function main() {
  console.log("Starting missing entity metadata processing...");
  
  // Process posts first
  await processMissingPostEntityMetadata();
  
  // Then process comments
  await processMissingCommentEntityMetadata();
  
  console.log("\nEntity metadata processing complete");
}

// Run the main function
main(); 