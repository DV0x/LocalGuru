require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  try {
    // Get credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Testing Supabase connection...');
    console.log('URL:', supabaseUrl);
    console.log('API Key (first few chars):', supabaseKey.substring(0, 10) + '...');
    
    // Create client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test database connection
    const { data, error } = await supabase.from('reddit_posts').select('id').limit(1);
    
    if (error) {
      console.error('Connection failed:', error);
      return false;
    }
    
    console.log('Connection successful!');
    console.log('Data sample:', data);
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

testConnection();