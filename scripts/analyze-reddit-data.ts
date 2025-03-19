import { fetchRedditTravelData } from '../utils/reddit-api';
import fs from 'fs';
import path from 'path';

// Function to analyze response structure and suggest database schema
function analyzeResponseStructure(data: any) {
  console.log('Analyzing Reddit API response structure...');
  
  // Sample post structure (based on first post)
  const subreddit = Object.keys(data)[0];
  const samplePost = data[subreddit].posts[0]?.data;
  const sampleComment = data[subreddit].sampleComments[0]?.data;
  
  if (!samplePost || !sampleComment) {
    console.error('No sample data available for analysis');
    return;
  }
  
  // Extract key fields from post
  const postFields = {
    id: samplePost.id,
    subreddit: samplePost.subreddit,
    title: samplePost.title,
    selftext: samplePost.selftext,
    author: samplePost.author,
    created_utc: samplePost.created_utc,
    score: samplePost.score,
    upvote_ratio: samplePost.upvote_ratio,
    num_comments: samplePost.num_comments,
    url: samplePost.url,
    permalink: samplePost.permalink,
    is_self: samplePost.is_self,
    stickied: samplePost.stickied
  };
  
  // Extract key fields from comment
  const commentFields = {
    id: sampleComment.id,
    parent_id: sampleComment.parent_id,
    body: sampleComment.body,
    author: sampleComment.author,
    created_utc: sampleComment.created_utc,
    score: sampleComment.score,
    permalink: sampleComment.permalink,
    stickied: sampleComment.stickied,
    depth: sampleComment.depth
  };
  
  // Suggested database schema
  const suggestedSchema = {
    posts: {
      id: 'text PRIMARY KEY',
      subreddit: 'text NOT NULL',
      title: 'text NOT NULL',
      selftext: 'text',
      author: 'text',
      created_utc: 'bigint NOT NULL',
      score: 'integer',
      upvote_ratio: 'float',
      num_comments: 'integer',
      url: 'text',
      permalink: 'text',
      is_self: 'boolean',
      stickied: 'boolean',
      fetched_at: 'timestamp with time zone DEFAULT now()',
      embedding: 'vector' // For semantic search
    },
    comments: {
      id: 'text PRIMARY KEY',
      post_id: 'text REFERENCES posts(id)',
      parent_id: 'text', // Either post ID or another comment ID
      body: 'text',
      author: 'text',
      created_utc: 'bigint NOT NULL',
      score: 'integer',
      permalink: 'text',
      stickied: 'boolean',
      depth: 'integer',
      fetched_at: 'timestamp with time zone DEFAULT now()',
      embedding: 'vector' // For semantic search
    }
  };
  
  console.log('\n=== Sample Post Fields ===');
  console.log(JSON.stringify(postFields, null, 2));
  
  console.log('\n=== Sample Comment Fields ===');
  console.log(JSON.stringify(commentFields, null, 2));
  
  console.log('\n=== Suggested Database Schema ===');
  console.log(JSON.stringify(suggestedSchema, null, 2));
  
  // Save the complete response to a file for further analysis
  const outputDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'reddit-sample-data.json'),
    JSON.stringify(data, null, 2)
  );
  
  console.log('\nComplete response saved to data/reddit-sample-data.json');
}

// Main function
async function main() {
  try {
    console.log('Fetching Reddit travel data...');
    const data = await fetchRedditTravelData();
    analyzeResponseStructure(data);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main(); 