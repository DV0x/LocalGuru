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
    replies?: {
      data: {
        children: RedditComment[];
      };
    };
    [key: string]: any; // For other properties
  };
}

interface PostWithComments {
  post: RedditPost;
  comments: RedditComment[];
}

// Function to get Reddit access token
async function getRedditAccessToken(): Promise<string> {
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://www.reddit.com/api/v1/access_token',
      auth: {
        username: REDDIT_CLIENT_ID,
        password: REDDIT_CLIENT_SECRET
      },
      data: `grant_type=password&username=${REDDIT_USERNAME}&password=${REDDIT_PASSWORD}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw error;
  }
}

// Function to get posts from a subreddit
async function getSubredditPosts(subreddit: string, limit: number = 10, sort: string = 'hot'): Promise<any[]> {
  try {
    const token = await getRedditAccessToken();
    const response = await axios({
      method: 'GET',
      url: `https://oauth.reddit.com/r/${subreddit}/${sort}?limit=${limit}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT
      }
    });

    return response.data.data.children;
  } catch (error) {
    console.error(`Error fetching ${sort} posts from r/${subreddit}:`, error);
    throw error;
  }
}

// Function to get comments for a post with full comment tree
async function getPostComments(subreddit: string, postId: string, limit: number = 100): Promise<PostWithComments> {
  try {
    const token = await getRedditAccessToken();
    const response = await axios({
      method: 'GET',
      url: `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?depth=10&limit=${limit}&threaded=true`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT
      }
    });

    // Reddit returns an array with 2 elements: [0] = post data, [1] = comments data
    const post = response.data[0].data.children[0];
    const comments = response.data[1].data.children;

    return { post, comments };
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    throw error;
  }
}

// Helper function to format timestamp to human-readable date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Function to recursively process comments and format them for markdown
function processCommentsForMarkdown(comments: any[], depth: number = 0): string {
  if (!comments || comments.length === 0) return '';

  let markdown = '';
  
  for (const comment of comments) {
    if (comment.kind !== 't1') continue; // Skip non-comment items
    
    const data = comment.data;
    if (data.body === '[deleted]' || data.body === '[removed]') continue;
    
    // Indentation based on comment depth
    const indent = '  '.repeat(depth);
    
    // Format the comment
    markdown += `${indent}- **${data.author}** (Score: ${data.score}) - ${formatDate(data.created_utc)}\n`;
    markdown += `${indent}  > ${data.body.replace(/\n/g, '\n' + indent + '  > ')}\n\n`;
    
    // Process replies if any
    if (data.replies && data.replies.data && data.replies.data.children && data.replies.data.children.length > 0) {
      markdown += processCommentsForMarkdown(data.replies.data.children, depth + 1);
    }
  }
  
  return markdown;
}

// Function to generate Markdown from Reddit data
function generateMarkdown(postsWithComments: PostWithComments[]): string {
  let markdown = `# Reddit Data Analysis\n\n`;
  markdown += `*This file contains 5 Reddit posts with their full comment trees, prepared for schema analysis.*\n\n`;
  markdown += `## Data Schema Recommendations\n\n`;
  
  // Add schema recommendations
  markdown += `### Recommended Post Schema\n\n`;
  markdown += "```typescript\n";
  markdown += `interface Post {\n`;
  markdown += `  id: string;                  // Unique post identifier\n`;
  markdown += `  subreddit: string;           // Subreddit name\n`;
  markdown += `  title: string;               // Post title\n`;
  markdown += `  content: string;             // Post content/body\n`;
  markdown += `  author: string;              // Author username\n`;
  markdown += `  created_at: Date;            // Creation timestamp\n`;
  markdown += `  score: number;               // Post score (upvotes - downvotes)\n`;
  markdown += `  upvote_ratio: number;        // Ratio of upvotes to all votes\n`;
  markdown += `  url: string;                 // URL of the post\n`;
  markdown += `  permalink: string;           // Reddit permalink to the post\n`;
  markdown += `  is_self_post: boolean;       // Whether it's a text post or link\n`;
  markdown += `  flair?: string;              // Optional post flair\n`;
  markdown += `  is_nsfw: boolean;            // Whether the post is marked NSFW\n`;
  markdown += `  is_spoiler: boolean;         // Whether the post is marked as spoiler\n`;
  markdown += `  comment_count: number;       // Total number of comments\n`;
  markdown += `}\n`;
  markdown += "```\n\n";
  
  markdown += `### Recommended Comment Schema\n\n`;
  markdown += "```typescript\n";
  markdown += `interface Comment {\n`;
  markdown += `  id: string;                  // Unique comment identifier\n`;
  markdown += `  post_id: string;             // ID of the parent post\n`;
  markdown += `  parent_id: string;           // ID of parent comment (or post if top-level)\n`;
  markdown += `  author: string;              // Comment author username\n`;
  markdown += `  content: string;             // Comment text content\n`;
  markdown += `  created_at: Date;            // Creation timestamp\n`;
  markdown += `  score: number;               // Comment score (upvotes - downvotes)\n`;
  markdown += `  depth: number;               // Nesting level of the comment\n`;
  markdown += `  permalink: string;           // Reddit permalink to the comment\n`;
  markdown += `  is_stickied: boolean;        // Whether the comment is pinned/stickied\n`;
  markdown += `  path: string[];              // Array storing the path of parent IDs\n`;
  markdown += `}\n`;
  markdown += "```\n\n";

  markdown += `### Filtering Strategies\n\n`;
  markdown += `1. **Post Filtering**:\n`;
  markdown += `   - By subreddit\n`;
  markdown += `   - By minimum score\n`;
  markdown += `   - By minimum comment count\n`;
  markdown += `   - By date range\n`;
  markdown += `   - By author\n`;
  markdown += `   - By flair\n\n`;
  
  markdown += `2. **Comment Filtering**:\n`;
  markdown += `   - By post ID\n`;
  markdown += `   - By parent comment ID\n`;
  markdown += `   - By depth (e.g., only top-level comments)\n`;
  markdown += `   - By minimum score\n`;
  markdown += `   - By author\n`;
  markdown += `   - By date\n`;
  markdown += `   - By keywords in content\n\n`;
  
  markdown += `3. **Tree Traversal**:\n`;
  markdown += `   - Use the \`path\` array to efficiently retrieve entire comment threads\n`;
  markdown += `   - Query comments by their position in the thread hierarchy\n`;
  markdown += `   - Reconstruct threads with efficient database queries\n\n`;

  markdown += `## Example Posts with Comments\n\n`;
  
  // Process each post with its comments
  postsWithComments.forEach((item, index) => {
    const post = item.post.data;
    const comments = item.comments;
    
    markdown += `### Post ${index + 1}: ${post.title}\n\n`;
    markdown += `**Author:** ${post.author}  \n`;
    markdown += `**Subreddit:** r/${post.subreddit}  \n`;
    markdown += `**Created:** ${formatDate(post.created_utc)}  \n`;
    markdown += `**Score:** ${post.score} (${Math.round(post.upvote_ratio * 100)}% upvoted)  \n`;
    markdown += `**Comments:** ${post.num_comments}  \n`;
    markdown += `**URL:** [${post.url}](${post.url})  \n\n`;
    
    // Post content
    if (post.selftext) {
      markdown += `**Content:**\n\n`;
      markdown += `> ${post.selftext.replace(/\n/g, '\n> ')}\n\n`;
    }
    
    // Comments
    markdown += `#### Comments:\n\n`;
    markdown += processCommentsForMarkdown(comments);
    
    markdown += `---\n\n`;
  });
  
  return markdown;
}

// Main function to fetch 5 posts with full comment trees
async function fetchFivePostsWithFullComments(): Promise<void> {
  try {
    console.log('Fetching 5 posts with full comment trees...');
    const subreddit = 'AskLosAngeles'; // Correct subreddit name
    
    // Get posts from both hot and top categories
    console.log(`Fetching hot posts from r/${subreddit}...`);
    const hotPosts = await getSubredditPosts(subreddit, 30, 'hot');
    
    console.log(`Fetching top posts from r/${subreddit}...`);
    const topPosts = await getSubredditPosts(subreddit, 30, 'top');
    
    // Combine posts and sort by number of comments
    const allPosts = [...hotPosts, ...topPosts]
      .filter(post => post.data.num_comments > 15) // Only posts with significant comments
      .sort((a, b) => b.data.num_comments - a.data.num_comments);
    
    // Take the top 5 posts with most comments
    const targetPosts = allPosts.slice(0, 5);
    
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
    
    // Generate markdown from the data
    const markdown = generateMarkdown(postsWithFullComments);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Save the markdown content
    fs.writeFileSync(
      path.join(outputDir, 'reddit-data-analysis.md'),
      markdown
    );
    
    // Also save the raw JSON data for reference
    fs.writeFileSync(
      path.join(outputDir, 'five-posts-with-comments.json'),
      JSON.stringify(postsWithFullComments, null, 2)
    );
    
    console.log('\nMarkdown analysis saved to data/reddit-data-analysis.md');
    console.log('Raw JSON data saved to data/five-posts-with-comments.json');
    
    // Display summary
    console.log('\n=== Summary of Fetched Posts ===');
    postsWithFullComments.forEach((item, index) => {
      const post = item.post.data;
      const commentCount = item.comments.length;
      
      console.log(`\n[${index + 1}] "${post.title}"`);
      console.log(`  - Author: ${post.author}`);
      console.log(`  - Score: ${post.score}`);
      console.log(`  - Comments: ${commentCount} (top-level) / ${post.num_comments} (total)`);
    });
  } catch (error) {
    console.error('Error fetching posts with comments:', error);
    throw error;
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    console.log('Starting Reddit data fetch and markdown analysis...');
    
    // Check for Reddit API credentials
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
      console.error('Error: Reddit API credentials are missing in .env.local file');
      process.exit(1);
    }
    
    // Fetch 5 posts with full comment trees and generate markdown
    await fetchFivePostsWithFullComments();
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 