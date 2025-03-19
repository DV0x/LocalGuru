import fs from 'fs';
import path from 'path';

// This script displays the full content of Reddit posts and their comments
// from the data/posts-with-comments.json file

// Interface definitions for Reddit post and comment structures
interface RedditPostData {
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
  [key: string]: any;
}

interface RedditPost {
  kind: string;
  data: RedditPostData;
}

interface RedditCommentData {
  id: string;
  parent_id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  depth: number;
  replies?: {
    data?: {
      children?: RedditComment[];
    }
  };
  [key: string]: any;
}

interface RedditComment {
  kind: string;
  data: RedditCommentData;
}

interface PostWithComments {
  post: RedditPost;
  comments: RedditComment[];
}

// Function to format date from UTC timestamp
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Function to display a single comment and its replies recursively
function displayComment(comment: RedditComment, indentLevel: number = 0): void {
  // Skip non-comment items
  if (comment.kind !== 't1') return;
  
  const indent = '  '.repeat(indentLevel);
  const commentData = comment.data;
  
  // Display comment details
  console.log(`${indent}Comment by u/${commentData.author} (Score: ${commentData.score}) - ${formatDate(commentData.created_utc)}`);
  console.log(`${indent}${commentData.body.replace(/\n/g, `\n${indent}`)}`);
  console.log(`${indent}---`);
  
  // Display replies if they exist
  if (commentData.replies && 
      commentData.replies.data && 
      commentData.replies.data.children && 
      commentData.replies.data.children.length > 0) {
    
    commentData.replies.data.children.forEach(reply => {
      displayComment(reply, indentLevel + 1);
    });
  }
}

// Function to display a post and all its comments
function displayPostWithComments(postWithComments: PostWithComments, index: number): void {
  const post = postWithComments.post.data;
  const comments = postWithComments.comments;
  
  console.log(`\n\n==================================================`);
  console.log(`POST #${index + 1}: ${post.title}`);
  console.log(`==================================================`);
  console.log(`Posted by u/${post.author} on ${formatDate(post.created_utc)}`);
  console.log(`Score: ${post.score} | Upvote ratio: ${post.upvote_ratio} | Comments: ${post.num_comments}`);
  console.log(`URL: https://www.reddit.com${post.permalink}`);
  console.log(`\nContent:\n${post.selftext || '[No text content]'}`);
  console.log(`\n----- COMMENTS (${comments.length} top-level) -----\n`);
  
  // Display all comments and their replies
  comments.forEach(comment => {
    displayComment(comment);
  });
}

// Main function to read and display the posts with comments
function displayAllPosts(): void {
  try {
    // Read the data file
    const dataPath = path.join(process.cwd(), 'data', 'posts-with-comments.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('Data file not found. Please run the reddit-data-fetcher.ts script first.');
      process.exit(1);
    }
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const postsWithComments: PostWithComments[] = JSON.parse(rawData);
    
    console.log(`Found ${postsWithComments.length} posts with comments.\n`);
    
    // Display each post with its comments
    postsWithComments.forEach((post, index) => {
      displayPostWithComments(post, index);
    });
    
  } catch (error) {
    console.error('Error displaying posts:', error);
    process.exit(1);
  }
}

// Run the script
displayAllPosts(); 