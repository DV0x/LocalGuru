import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('FetchUpdateData');

async function fetchAndUpdateData() {
  logger.info('Starting data fetch and update test');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL and key must be provided in environment variables');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Fetch some posts
    logger.info('Fetching recent posts');
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('id, title, created_at, subreddit')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (postsError) {
      logger.error(`Error fetching posts: ${postsError.message}`);
      process.exit(1);
    }
    
    if (!posts || posts.length === 0) {
      logger.error('No posts found');
      process.exit(1);
    }
    
    logger.info(`Found ${posts.length} posts`);
    console.log(posts);
    
    // 2. Select a post to view its comments
    const selectedPost = posts[0];
    logger.info(`Fetching comments for post ${selectedPost.id}: "${selectedPost.title}"`);
    
    const { data: comments, error: commentsError } = await supabase
      .from('reddit_comments')
      .select('id, content, created_at, author_id')
      .eq('post_id', selectedPost.id)
      .order('created_at', { ascending: true })
      .limit(5);
    
    if (commentsError) {
      logger.error(`Error fetching comments: ${commentsError.message}`);
    } else if (!comments || comments.length === 0) {
      logger.info('No comments found for this post');
    } else {
      logger.info(`Found ${comments.length} comments for this post`);
      console.log(comments);
    }
    
    // 3. Get full detail of one post to see all available fields
    logger.info(`Fetching full details for post ${selectedPost.id}`);
    
    const { data: fullPost, error: fullPostError } = await supabase
      .from('reddit_posts')
      .select('*')
      .eq('id', selectedPost.id)
      .single();
    
    if (fullPostError) {
      logger.error(`Error fetching full post details: ${fullPostError.message}`);
    } else {
      logger.info('Full post details:');
      console.log(JSON.stringify(fullPost, null, 2));
      
      // List all available fields
      logger.info('Available fields for posts:');
      const postFields = Object.keys(fullPost).join(', ');
      logger.info(postFields);
    }
    
    // 4. Get full detail of one comment if available
    if (comments && comments.length > 0) {
      const selectedComment = comments[0];
      logger.info(`Fetching full details for comment ${selectedComment.id}`);
      
      const { data: fullComment, error: fullCommentError } = await supabase
        .from('reddit_comments')
        .select('*')
        .eq('id', selectedComment.id)
        .single();
      
      if (fullCommentError) {
        logger.error(`Error fetching full comment details: ${fullCommentError.message}`);
      } else {
        logger.info('Full comment details:');
        console.log(JSON.stringify(fullComment, null, 2));
        
        // List all available fields
        logger.info('Available fields for comments:');
        const commentFields = Object.keys(fullComment).join(', ');
        logger.info(commentFields);
      }
    }
    
    // 5. Demonstrate updating a post
    logger.info('Demonstrating post update');
    const timestamp = new Date().toISOString();
    
    // Setup update data object
    const postUpdateData = {
      title: `${selectedPost.title} [Updated: ${timestamp}]`
    };
    
    logger.info(`Updating post ${selectedPost.id} with new title`);
    logger.info(`New title: ${postUpdateData.title}`);
    
    // Perform the update
    const { data: updatedPost, error: updateError } = await supabase
      .from('reddit_posts')
      .update(postUpdateData)
      .eq('id', selectedPost.id)
      .select();
    
    if (updateError) {
      logger.error(`Error updating post: ${updateError.message}`);
    } else {
      logger.info('Post updated successfully:');
      console.log(JSON.stringify(updatedPost, null, 2));
      
      // Check embedding queue for this post
      logger.info('To check if this update triggered the embedding queue, run this SQL in the Supabase dashboard:');
      logger.info(`
        SELECT * FROM util.embedding_queue 
        WHERE record_id = '${selectedPost.id}'
        AND table_name = 'reddit_posts'
        ORDER BY created_at DESC
        LIMIT 5;
      `);
    }
    
    // 6. Demonstrate updating a comment if available
    if (comments && comments.length > 0) {
      const selectedComment = comments[0];
      logger.info('Demonstrating comment update');
      
      // Setup update data object
      const commentUpdateData = {
        content: `${selectedComment.content} [Updated: ${timestamp}]`
      };
      
      logger.info(`Updating comment ${selectedComment.id}`);
      logger.info(`New content: ${commentUpdateData.content}`);
      
      // Perform the update
      const { data: updatedComment, error: commentUpdateError } = await supabase
        .from('reddit_comments')
        .update(commentUpdateData)
        .eq('id', selectedComment.id)
        .select();
      
      if (commentUpdateError) {
        logger.error(`Error updating comment: ${commentUpdateError.message}`);
      } else {
        logger.info('Comment updated successfully:');
        console.log(JSON.stringify(updatedComment, null, 2));
        
        // Check embedding queue for this comment
        logger.info('To check if this update triggered the embedding queue, run this SQL in the Supabase dashboard:');
        logger.info(`
          SELECT * FROM util.embedding_queue 
          WHERE record_id = '${selectedComment.id}'
          AND table_name = 'reddit_comments'
          ORDER BY created_at DESC
          LIMIT 5;
        `);
      }
    }
    
    logger.info('Data fetch and update test completed');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Test failed: ${err.message}`, err);
    
    if (err.stack) {
      logger.error(`Stack trace: ${err.stack}`);
    }
    
    process.exit(1);
  }
}

// Run the test
fetchAndUpdateData().catch(err => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Test failed:', errorObj);
  process.exit(1);
}); 