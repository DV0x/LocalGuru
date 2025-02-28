// Direct test script for API credentials
// Run with: node -r dotenv/config scripts/test-apis.js

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Buffer } = require('buffer');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Apply the environment variables
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Reddit API credentials
const redditClientId = process.env.REDDIT_CLIENT_ID;
const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;
const redditUsername = process.env.REDDIT_USERNAME;
const redditPassword = process.env.REDDIT_PASSWORD;

// OpenAI API credentials
const openaiApiKey = process.env.OPENAI_API_KEY;

// Test Reddit API
async function testRedditAPI() {
  console.log('\n--- Testing Reddit API ---');
  
  if (!redditClientId || !redditClientSecret || !redditUsername || !redditPassword) {
    console.error('❌ Missing Reddit API credentials');
    return false;
  }
  
  try {
    console.log('Authenticating with Reddit...');
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${redditClientId}:${redditClientSecret}`).toString('base64')}`,
        'User-Agent': 'LocalGuru/1.0.0',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: redditUsername,
        password: redditPassword,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Reddit authentication failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Successfully authenticated with Reddit');
    console.log(`   Access token: ${data.access_token.substring(0, 10)}...`);
    
    // Test search
    console.log('Searching Reddit for travel content...');
    const searchResponse = await fetch(
      `https://oauth.reddit.com/search?q=best+places+to+visit+in+europe&limit=2`,
      {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'User-Agent': 'LocalGuru/1.0.0',
        },
      }
    );
    
    if (!searchResponse.ok) {
      throw new Error(`Reddit search failed: ${searchResponse.status} ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    console.log(`✅ Successfully searched Reddit (found ${searchData.data.children.length} posts)`);
    
    return true;
  } catch (error) {
    console.error(`❌ Reddit API test failed: ${error.message}`);
    return false;
  }
}

// Test OpenAI API
async function testOpenAIAPI() {
  console.log('\n--- Testing OpenAI API ---');
  
  if (!openaiApiKey) {
    console.error('❌ Missing OpenAI API key');
    return false;
  }
  
  try {
    console.log('Generating embeddings with OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Hello world',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Successfully generated embeddings with OpenAI');
    console.log(`   Embedding dimensions: ${data.data[0].embedding.length}`);
    
    return true;
  } catch (error) {
    console.error(`❌ OpenAI API test failed: ${error.message}`);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('=== API Credentials Test ===');
  console.log('Testing your API credentials directly...');
  
  const redditSuccess = await testRedditAPI();
  const openaiSuccess = await testOpenAIAPI();
  
  console.log('\n=== Test Results ===');
  console.log(`Reddit API: ${redditSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`OpenAI API: ${openaiSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (redditSuccess && openaiSuccess) {
    console.log('\n✅ All API credentials are working correctly!');
  } else {
    console.log('\n❌ Some API credentials are not working. Please check the errors above.');
  }
}

runTests().catch(error => {
  console.error('Test script error:', error);
}); 