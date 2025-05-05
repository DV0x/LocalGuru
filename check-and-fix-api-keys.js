const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * This script helps diagnose Supabase API key issues
 * It provides a test function for manually trying new keys before updating your environment files
 */

// Current API credentials
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase API Key Diagnostic Tool');
console.log('===============================');
console.log('\nCurrent Configuration:');
console.log(`SUPABASE_URL: ${supabaseUrl || 'Not set'}`);
console.log(`Service Role Key length: ${serviceRoleKey ? serviceRoleKey.length : 'Not set'}`);
console.log(`Anon Key length: ${anonKey ? anonKey.length : 'Not set'}`);

// Extract project ID from URL
if (supabaseUrl) {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectId = match ? match[1] : 'unknown';
  console.log(`\nProject ID: ${projectId}`);
}

// Test current credentials
async function testConnection() {
  console.log('\nTesting current Supabase API credentials...');
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('❌ Missing required credentials');
    return;
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    // Try a query
    const { data, error } = await supabase.from('content_chunks').select('id').limit(1);
    
    if (error) {
      console.log('❌ API connection failed with error:');
      console.log(error.message);
      
      if (error.message.includes('API key')) {
        console.log('\nThe API key appears to be invalid or has been revoked.');
        console.log('Please visit your Supabase dashboard to get fresh API keys:');
        console.log('1. Go to https://app.supabase.com');
        console.log('2. Select your project');
        console.log('3. Navigate to Project Settings > API');
        console.log('4. Copy both the service_role key and anon/public key');
        console.log('\nThen update your .env and .env.local files with these new keys');
      }
    } else {
      console.log('✅ API connection successful!');
      console.log(`Retrieved ${data.length} records`);
    }
  } catch (err) {
    console.log('❌ Exception occurred:', err.message);
  }
}

// Guide to updating API keys
function showUpdateInstructions() {
  console.log('\nTo update your Supabase API keys:');
  console.log('1. Edit your .env and .env.local files');
  console.log('2. Replace the values for these variables:');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('3. Make sure you keep SUPABASE_URL the same');
  console.log('4. Restart your application for changes to take effect');
  
  console.log('\nAPI keys can be found in your Supabase dashboard:');
  console.log('Project Settings > API');
}

// Function to test database connection
async function testDatabaseConnection() {
  console.log('\nTesting direct database connection...');
  
  const { Pool } = require('pg');
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.log('❌ No DATABASE_URL found');
    return;
  }
  
  try {
    const pool = new Pool({ connectionString: dbUrl });
    const result = await pool.query('SELECT 1 AS test');
    console.log('✅ Database connection successful!');
    await pool.end();
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
  }
}

// Run the tests and show instructions
async function run() {
  await testConnection();
  await testDatabaseConnection();
  showUpdateInstructions();
}

run(); 