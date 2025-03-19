import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from root .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
// Also try regular .env file if .env.local doesn't have all variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Supabase client with schema setting
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    }
  }
);

console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Service role key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Add function to disable triggers
async function disableTriggers() {
  console.log("Disabling triggers temporarily for import...");
  try {
    // Disable post triggers
    await supabase.rpc('alter_triggers', { 
      table_name: 'reddit_posts',
      enable: false
    });
    
    // Disable comment triggers
    await supabase.rpc('alter_triggers', { 
      table_name: 'reddit_comments',
      enable: false
    });
    
    console.log("Triggers disabled successfully");
    return true;
  } catch (error) {
    console.error("Failed to disable triggers:", error);
    return false;
  }
}

// Add function to re-enable triggers
async function enableTriggers() {
  console.log("Re-enabling triggers...");
  try {
    // Re-enable post triggers
    await supabase.rpc('alter_triggers', { 
      table_name: 'reddit_posts',
      enable: true
    });
    
    // Re-enable comment triggers
    await supabase.rpc('alter_triggers', { 
      table_name: 'reddit_comments',
      enable: true
    });
    
    console.log("Triggers re-enabled successfully");
    return true;
  } catch (error) {
    console.error("Failed to re-enable triggers:", error);
    return false;
  }
}

// Reddit API configuration
const REDDIT_USER_AGENT = 'LocalGuru:v1.0 (by /u/yourusername)';
const SUBREDDIT = 'AskSF'; // Changed to AskSF
const POST_LIMIT = 10;     // Changed to 10 posts
const COMMENT_FETCH_LIMIT = 1000; // Set high limit to get all comments

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  score: number;
  subreddit: string;
  permalink: string;
  url: string;
  upvote_ratio: number;
  is_self: boolean;
  over_18: boolean;
  spoiler: boolean;
  link_flair_text?: string;
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  parent_id: string;
  replies?: {
    data?: {
      children?: any[];
    };
  };
  depth: number;
  stickied: boolean;
}

/**
 * Get a Reddit access token
 */
async function getRedditAccessToken(): Promise<string> {
  try {
    // Reddit credentials
    const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
    const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
    const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
    const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
      throw new Error('Missing Reddit API credentials in environment variables');
    }

    const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      `grant_type=password&username=${REDDIT_USERNAME}&password=${REDDIT_PASSWORD}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': REDDIT_USER_AGENT,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw error;
  }
}

/**
 * Find or create a Reddit user
 */
async function findOrCreateUser(username: string): Promise<string> {
  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('reddit_users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return existingUser.id;
    }

    // Create new user
    const userId = username === '[deleted]' ? `deleted_${uuidv4().slice(0, 8)}` : username;
    await supabase.from('reddit_users').insert({
      id: userId,
      username: username,
      created_at: new Date().toISOString(),
      is_bot: false,
    });

    return userId;
  } catch (error) {
    console.error(`Error processing user ${username}:`, error);
    throw error;
  }
}

// Add function to process posts without using triggers
async function processPostManually(post: RedditPost): Promise<string> {
  try {
    const authorId = await findOrCreateUser(post.author);

    // Construct the SQL query directly to insert the post
    const { data, error } = await supabase.rpc('insert_reddit_post_without_trigger', { 
      post_id: post.id,
      post_subreddit: post.subreddit,
      post_title: post.title,
      post_content: post.selftext || '',
      post_url: post.url,
      post_permalink: post.permalink,
      post_author_id: authorId,
      post_created_at: new Date(post.created_utc * 1000).toISOString(),
      post_score: post.score,
      post_upvote_ratio: post.upvote_ratio,
      post_is_nsfw: post.over_18,
      post_is_spoiler: post.spoiler,
      post_flair: post.link_flair_text || null,
      post_is_self_post: post.is_self,
      post_original_json: post
    });

    if (error) {
      console.error(`Error inserting post ${post.id}:`, error);
      
      // Fallback to direct insert if the RPC doesn't exist
      console.log("Trying direct insert as fallback...");
      const postRecord = {
        id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        content: post.selftext || '',
        url: post.url,
        permalink: post.permalink,
        author_id: authorId,
        created_at: new Date(post.created_utc * 1000).toISOString(),
        score: post.score,
        upvote_ratio: post.upvote_ratio,
        is_nsfw: post.over_18,
        is_spoiler: post.spoiler,
        flair: post.link_flair_text || null,
        is_self_post: post.is_self,
        original_json: post,
      };

      const { error: fallbackError } = await supabase
        .from('reddit_posts')
        .upsert(postRecord, { onConflict: 'id' });

      if (fallbackError) {
        console.error(`Fallback insert for post ${post.id} also failed:`, fallbackError);
        throw fallbackError;
      }
    }

    console.log(`Processed post: ${post.title.substring(0, 50)}...`);
    return post.id;
  } catch (error) {
    console.error(`Error processing post:`, error);
    throw error;
  }
}

// Also modify the processComments function to handle fallback for comments
async function processCommentsManually(
  comments: any[],
  postId: string,
  parentId: string | null = null,
  depth: number = 0,
  path: string[] = []
): Promise<void> {
  if (!comments || comments.length === 0) return;
  
  for (const comment of comments) {
    if (comment.kind !== 't1' || !comment.data) continue;
    const commentData = comment.data as RedditComment;

    // Skip deleted comments with no content
    if (commentData.author === '[deleted]' && !commentData.body) continue;

    try {
      // Find or create the comment author
      const authorId = await findOrCreateUser(commentData.author);

      // Construct the path for this comment
      const currentPath = [...path, commentData.id];

      try {
        // Try using RPC function first
        const { error } = await supabase.rpc('insert_reddit_comment_without_trigger', {
          comment_id: commentData.id,
          comment_post_id: postId,
          comment_parent_id: parentId,
          comment_author_id: authorId,
          comment_content: commentData.body || '',
          comment_created_at: new Date(commentData.created_utc * 1000).toISOString(),
          comment_score: commentData.score,
          comment_depth: depth,
          comment_path: currentPath,
          comment_is_stickied: commentData.stickied,
          comment_original_json: commentData
        });

        if (error) {
          // Fallback to direct insert
          console.log(`Trying direct insert for comment ${commentData.id} as fallback...`);
          const commentRecord = {
            id: commentData.id,
            post_id: postId,
            parent_id: parentId,
            author_id: authorId,
            content: commentData.body || '',
            created_at: new Date(commentData.created_utc * 1000).toISOString(),
            score: commentData.score,
            depth: depth,
            path: currentPath,
            is_stickied: commentData.stickied,
            original_json: commentData,
          };

          const { error: fallbackError } = await supabase
            .from('reddit_comments')
            .upsert(commentRecord, { onConflict: 'id' });

          if (fallbackError) {
            console.error(`Fallback insert for comment ${commentData.id} also failed:`, fallbackError);
            throw fallbackError;
          }
        }
      } catch (error) {
        console.error(`Error processing comment ${commentData.id}:`, error);
        throw error;
      }

      console.log(`Processed comment: ${commentData.id} (depth: ${depth})`);

      // Process replies recursively
      if (
        commentData.replies &&
        commentData.replies.data &&
        commentData.replies.data.children &&
        commentData.replies.data.children.length > 0
      ) {
        await processCommentsManually(
          commentData.replies.data.children,
          postId,
          commentData.id,
          depth + 1,
          currentPath
        );
      }
    } catch (error) {
      console.error(`Error processing comment ${commentData.id}:`, error);
      // Continue with other comments
    }
  }
}

/**
 * Fetch posts from a subreddit
 */
async function fetchSubredditPosts(token: string): Promise<any[]> {
  try {
    // Fetch top posts instead of hot for potentially more comments
    const response = await axios.get(
      `https://oauth.reddit.com/r/${SUBREDDIT}/top?limit=${POST_LIMIT}&t=month`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': REDDIT_USER_AGENT,
        },
      }
    );

    return response.data.data.children;
  } catch (error) {
    console.error(`Error fetching posts from r/${SUBREDDIT}:`, error);
    throw error;
  }
}

/**
 * Fetch comments for a post
 */
async function fetchPostComments(token: string, postId: string, permalink: string): Promise<any[]> {
  try {
    // Use a high limit and depth to get all comments including nested ones
    const response = await axios.get(
      `https://oauth.reddit.com${permalink}?limit=${COMMENT_FETCH_LIMIT}&depth=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': REDDIT_USER_AGENT,
        },
      }
    );

    // Comments are in the second element of the response array
    return response.data[1].data.children;
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    throw error;
  }
}

/**
 * Main import function
 */
async function importFromReddit(): Promise<void> {
  try {
    console.log(`Starting import from r/${SUBREDDIT}...`);
    
    // Get Reddit access token
    const token = await getRedditAccessToken();
    console.log('Successfully obtained Reddit access token');
    
    // Fetch posts
    const posts = await fetchSubredditPosts(token);
    console.log(`Fetched ${posts.length} posts from r/${SUBREDDIT}`);
    
    // Process all fetched posts (up to POST_LIMIT)
    console.log(`Processing ${posts.length} posts with all their comments`);
    
    // Process each post and its comments
    for (const postItem of posts) {
      const postData = postItem.data as RedditPost;
      console.log(`\nProcessing post: ${postData.title.substring(0, 50)}...`);
      
      try {
        // Process the post
        await processPostManually(postData);
        
        // Fetch and process comments
        const comments = await fetchPostComments(token, postData.id, postData.permalink);
        console.log(`Fetched ${comments.length} top-level comments for post ${postData.id}`);
        
        // Process all comments including nested ones
        await processCommentsManually(comments, postData.id);
        
        console.log(`Completed processing post ${postData.id} with all comments`);
      } catch (error) {
        console.error(`Error processing post ${postData.id}:`, error);
        // Continue with next post
      }
      
      // Wait between posts to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\nImport completed successfully. Imported ${posts.length} posts from r/${SUBREDDIT} with all their comments.`);
  } catch (error) {
    console.error('Import failed:', error);
  }
}

// Main execution function
async function main() {
  try {
    // First clean up existing data to avoid duplicates
    console.log('Truncating existing data for r/AskSF...');
    
    const { error: commentsDeleteError } = await supabase
      .from('reddit_comments')
      .delete()
      .eq('post_id', supabase.from('reddit_posts').select('id').eq('subreddit', SUBREDDIT));
    
    if (commentsDeleteError) {
      console.error('Error deleting existing comments:', commentsDeleteError);
    }
    
    const { error: postsDeleteError } = await supabase
      .from('reddit_posts')
      .delete()
      .eq('subreddit', SUBREDDIT);
    
    if (postsDeleteError) {
      console.error('Error deleting existing posts:', postsDeleteError);
    }
    
    // Disable triggers to speed up import
    await disableTriggers();
    
    // Import the data
    await importFromReddit();
    
    // Re-enable triggers
    await enableTriggers();
    
    // Queue the content for embedding generation
    console.log('Import completed. Queueing posts and comments for embedding generation...');
    
    // Use a function to queue posts for embedding, if available
    try {
      await supabase.rpc('refresh_content_representations', {
        refresh_type: 'all',
        batch_size: 100
      });
      console.log('Successfully queued content for embedding generation');
    } catch (error) {
      console.error('Error queueing content for processing:', error);
    }
    
    console.log('Processing completed.');
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

// Run the main function
main()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed with error:', error);
    process.exit(1);
  }); 