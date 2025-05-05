require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Using Supabase URL:', supabaseUrl);
    console.log('API Key (first 10 chars):', supabaseKey?.substring(0, 10) + '...');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try a simple query
    const { data, error } = await supabase.from('reddit_posts').select('id').limit(1);
    
    if (error) {
      console.error('Connection test failed:', error);
      return false;
    }
    
    console.log('Connection successful!', data ? 'Data retrieved.' : 'No data found, but connection works.');
    return true;
  } catch (error) {
    console.error('Error testing connection:', error.message);
    return false;
  }
}

// Sync environment variables between files
function syncEnvironmentVariables() {
  try {
    // Read existing .env.local file
    const envLocalContent = fs.readFileSync('.env.local', 'utf8');
    
    // Update embedding processor .env file
    fs.writeFileSync('embedding-processor/.env', envLocalContent, 'utf8');
    console.log('Updated embedding-processor/.env');
    
    console.log('Environment variables synchronized successfully.');
  } catch (error) {
    console.error('Error syncing environment variables:', error.message);
  }
}

// Main function
async function main() {
  console.log('Testing Supabase connection...');
  const connectionOk = await testSupabaseConnection();
  
  if (connectionOk) {
    console.log('Supabase connection is working properly.');
    syncEnvironmentVariables();
  } else {
    console.log('Supabase connection failed. Please check your environment variables.');
  }
}

main();