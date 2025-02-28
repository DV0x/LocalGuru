// Simple script to test if environment variables are loaded correctly
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Apply the environment variables
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Check if environment variables are loaded
console.log('=== Environment Variables Test ===');
console.log('Checking if environment variables are loaded correctly...\n');

// Check OpenAI API key
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey) {
  console.log('✅ OpenAI API Key: Found');
  console.log(`   First 10 chars: ${openaiKey.substring(0, 10)}...`);
} else {
  console.log('❌ OpenAI API Key: Not found');
}

// Check Reddit credentials
const redditClientId = process.env.REDDIT_CLIENT_ID;
const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;
const redditUsername = process.env.REDDIT_USERNAME;
const redditPassword = process.env.REDDIT_PASSWORD;

console.log('\nReddit Credentials:');
console.log(`- Client ID: ${redditClientId ? '✅ Found' : '❌ Not found'}`);
console.log(`- Client Secret: ${redditClientSecret ? '✅ Found' : '❌ Not found'}`);
console.log(`- Username: ${redditUsername ? '✅ Found' : '❌ Not found'}`);
console.log(`- Password: ${redditPassword ? '✅ Found' : '❌ Not found'}`);

// Check Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\nSupabase Credentials:');
console.log(`- URL: ${supabaseUrl ? '✅ Found' : '❌ Not found'}`);
console.log(`- Service Role Key: ${supabaseKey ? '✅ Found' : '❌ Not found'}`);

console.log('\n=== Test Complete ==='); 