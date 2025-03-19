import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Reddit API credentials
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || '';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';
const REDDIT_USERNAME = process.env.REDDIT_USERNAME || '';
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD || '';
const REDDIT_USER_AGENT = 'web:localguru:v1.0.0 (by /u/' + REDDIT_USERNAME + ')';

// Type definitions for Reddit post and comment
interface RedditPost {
  kind: string;
  data: {
    id: string;
    subreddit: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    score: number;
    upvote_ratio: number;
    num_comments: number;
    url: string;
    permalink: string;
    is_self: boolean;
    stickied: boolean;
    link_flair_text: string | null;
    over_18: boolean;
    spoiler: boolean;
    [key: string]: any; // For other properties
  };
}

interface RedditComment {
  kind: string;
  data: {
    id: string;
    parent_id: string;
    body: string;
    author: string;
    created_utc: number;
    score: number;
    permalink: string;
    stickied: boolean;
    depth: number;
    [key: string]: any; // For other properties
  };
}

// Define interface for the post and comments result
interface PostWithComments {
  post: RedditPost;
  comments: RedditComment[];
}

// Function to get Reddit access token
async function getRedditAccessToken(): Promise<string> {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://www.reddit.com/api/v1/access_token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      data: `grant_type=password&username=${REDDIT_USERNAME}&password=${REDDIT_PASSWORD}`
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw error;
  }
}

// Function to fetch posts from a subreddit
async function getSubredditPosts(subreddit: string, limit: number = 10, sort: string = 'hot'): Promise<any[]> {
  try {
    const accessToken = await getRedditAccessToken();
    
    const response = await axios({
      method: 'get',
      url: `https://oauth.reddit.com/r/${subreddit}/${sort}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      params: {
        limit
      }
    });
    
    return response.data.data.children;
  } catch (error) {
    console.error(`Error fetching posts from r/${subreddit}:`, error);
    throw error;
  }
}

// Function to search posts in a subreddit by query
async function searchSubreddit(subreddit: string, query: string, limit: number = 10): Promise<any[]> {
  try {
    const accessToken = await getRedditAccessToken();
    
    const response = await axios({
      method: 'get',
      url: `https://oauth.reddit.com/r/${subreddit}/search`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      params: {
        q: query,
        restrict_sr: true,
        sort: 'relevance',
        t: 'all',
        limit
      }
    });
    
    return response.data.data.children;
  } catch (error) {
    console.error(`Error searching r/${subreddit} for "${query}":`, error);
    throw error;
  }
}

// Function to fetch comments for a specific post
async function getPostComments(subreddit: string, postId: string, limit: number = 100): Promise<PostWithComments> {
  try {
    const accessToken = await getRedditAccessToken();
    
    const response = await axios({
      method: 'get',
      url: `https://oauth.reddit.com/r/${subreddit}/comments/${postId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      params: {
        limit,
        depth: 10, // Increase depth to get deeper nested comments
        threaded: true, // Get threaded comments
      }
    });
    
    // Reddit returns an array with two elements:
    // [0] = post details
    // [1] = comments
    return {
      post: response.data[0].data.children[0],
      comments: response.data[1].data.children
    };
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    throw error;
  }
}

// Function to specifically fetch 3 posts with their full comment trees
async function fetchPostsWithComments(): Promise<void> {
  try {
    console.log('Fetching 3 posts with full comment trees...');
    const subreddit = 'AskSF';
    
    // Get hot and top posts
    console.log(`Fetching hot posts from r/${subreddit}...`);
    const hotPosts = await getSubredditPosts(subreddit, 30, 'hot');
    
    console.log(`Fetching top posts from r/${subreddit}...`);
    const topPosts = await getSubredditPosts(subreddit, 30, 'top');
    
    // Combine posts and sort by number of comments
    const allPosts = [...hotPosts, ...topPosts]
      .filter(post => post.data.num_comments > 20) // Only posts with significant comments
      .sort((a, b) => b.data.num_comments - a.data.num_comments);
    
    // Take the top 3 posts with most comments
    const targetPosts = allPosts.slice(0, 3);
    
    if (targetPosts.length === 0) {
      console.log('No posts with significant comments found.');
      return;
    }
    
    // Array to store the results
    const postsWithFullComments = [];
    
    // Fetch comments for each post
    for (const post of targetPosts) {
      console.log(`\nFetching full comment tree for post: "${post.data.title}" (${post.data.num_comments} comments)`);
      const result = await getPostComments(subreddit, post.data.id);
      postsWithFullComments.push(result);
    }
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Save the posts with their comment trees
    fs.writeFileSync(
      path.join(outputDir, 'posts-with-comments.json'),
      JSON.stringify(postsWithFullComments, null, 2)
    );
    
    // Display summary
    console.log('\n=== Summary of Fetched Posts ===');
    postsWithFullComments.forEach((item, index) => {
      const post = item.post.data;
      const commentCount = item.comments.length;
      
      console.log(`\n[${index + 1}] "${post.title}"`);
      console.log(`  - Author: ${post.author}`);
      console.log(`  - Score: ${post.score}`);
      console.log(`  - Comments: ${commentCount} (top-level) / ${post.num_comments} (total)`);
      console.log(`  - URL: https://www.reddit.com${post.permalink}`);
      
      // Show first few comments
      if (commentCount > 0) {
        console.log('\n  Top comments:');
        item.comments.slice(0, 3).forEach((comment: any, i: number) => {
          if (comment.kind === 't1') { // t1 = comment
            console.log(`    ${i + 1}. ${comment.data.author}: ${comment.data.body.substring(0, 100)}${comment.data.body.length > 100 ? '...' : ''}`);
            
            // Check if the comment has replies
            const replies = comment.data.replies;
            if (replies && replies.data && replies.data.children && replies.data.children.length > 0) {
              console.log(`       (Has ${replies.data.children.length} replies)`);
            }
          }
        });
      }
    });
    
    console.log('\nComplete data saved to data/posts-with-comments.json');
  } catch (error) {
    console.error('Error fetching posts with comments:', error);
    throw error;
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    console.log('Starting Reddit data fetch for posts with full comment trees...');
    
    // Check for Reddit API credentials
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
      console.error('Error: Reddit API credentials are missing in .env.local file');
      process.exit(1);
    }
    
    // Fetch posts with full comment trees
    await fetchPostsWithComments();
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 