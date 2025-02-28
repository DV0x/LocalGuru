// Script to fetch Reddit data, generate embeddings, and store in Supabase
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Apply the environment variables
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// OpenAI credentials
const openaiApiKey = process.env.OPENAI_API_KEY;

// Reddit credentials
const redditClientId = process.env.REDDIT_CLIENT_ID;
const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;
const redditUsername = process.env.REDDIT_USERNAME;
const redditPassword = process.env.REDDIT_PASSWORD;

// Check for required credentials
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('❌ Missing OpenAI API key');
  process.exit(1);
}

if (!redditClientId || !redditClientSecret || !redditUsername || !redditPassword) {
  console.error('❌ Missing Reddit credentials');
  process.exit(1);
}

// Create clients
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  }
});

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Reddit API authentication
async function getRedditAccessToken() {
  const authString = Buffer.from(`${redditClientId}:${redditClientSecret}`).toString('base64');
  
  try {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: redditUsername,
        password: redditPassword,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw error;
  }
}

// Search Reddit for travel-related posts
async function searchReddit(query, limit = 25) {
  const accessToken = await getRedditAccessToken();
  
  try {
    const response = await fetch(`https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance&t=year`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'LocalGuru/1.0.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Reddit search API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process and return the posts
    return data.data.children
      .filter(post => post.data.selftext && post.data.selftext.length > 100)
      .map(post => ({
        post_id: post.data.id,
        title: post.data.title,
        content: post.data.selftext,
        url: `https://www.reddit.com${post.data.permalink}`,
        subreddit: post.data.subreddit,
        author: post.data.author,
        score: post.data.score,
        created_at: new Date(post.data.created_utc * 1000).toISOString(),
      }));
  } catch (error) {
    console.error('Error searching Reddit:', error);
    throw error;
  }
}

// Generate embeddings for a text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Store a post with its embedding in Supabase
async function storePostWithEmbedding(post, embedding) {
  try {
    const { error } = await supabase
      .from('reddit_posts')
      .upsert({
        post_id: post.post_id,
        title: post.title,
        content: post.content,
        url: post.url,
        subreddit: post.subreddit,
        author: post.author,
        score: post.score,
        created_at: post.created_at,
        embedding: embedding,
        metadata: { source: 'reddit' },
      }, { onConflict: 'post_id' });
    
    if (error) {
      console.error('Error storing post:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error storing post:', error);
    return false;
  }
}

// Main function to ingest Reddit data
async function ingestRedditData() {
  console.log('=== Reddit Data Ingestion ===');
  console.log('Fetching travel-related posts from Reddit, generating embeddings, and storing in Supabase...\n');
  
  const searchQueries = [
    'best places to visit in europe',
    'travel recommendations asia',
    'hidden gems travel',
    'best travel destinations',
    'travel tips and tricks',
    'budget travel destinations',
    'backpacking adventures',
    'luxury travel experiences',
    'family vacation ideas',
    'solo travel destinations',
  ];
  
  let totalProcessed = 0;
  let totalStored = 0;
  
  try {
    for (const query of searchQueries) {
      console.log(`\nSearching Reddit for: "${query}"`);
      const posts = await searchReddit(query, 25);
      console.log(`Found ${posts.length} posts`);
      
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        console.log(`Processing post ${i + 1}/${posts.length}: ${post.title.substring(0, 50)}...`);
        
        // Generate embedding for the post (title + content)
        const text = `${post.title}\n\n${post.content}`;
        const embedding = await generateEmbedding(text);
        
        // Store the post with its embedding
        const success = await storePostWithEmbedding(post, embedding);
        
        if (success) {
          totalStored++;
          console.log('✅ Post stored successfully');
        } else {
          console.log('❌ Failed to store post');
        }
        
        totalProcessed++;
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('\n=== Ingestion Complete ===');
    console.log(`Processed ${totalProcessed} posts`);
    console.log(`Successfully stored ${totalStored} posts`);
    
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    process.exit(1);
  }
}

// Run the ingestion
ingestRedditData(); 