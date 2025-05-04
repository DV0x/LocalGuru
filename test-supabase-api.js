const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testConnection() {
  console.log('Testing Supabase API connection:');
  console.log('===============================');
  
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    return;
  }
  
  console.log(`Using Supabase URL: ${supabaseUrl}`);
  console.log(`Service role key length: ${serviceRoleKey.length}`);
  
  try {
    // Create Supabase client
    console.log('\nInitializing Supabase client...');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // Test connection with a simple query
    console.log('Attempting to query the database...');
    
    // First try a simple health check if available
    try {
      const { data: healthData, error: healthError } = await supabase.rpc('ping');
      if (!healthError) {
        console.log('✅ Health check passed:', healthData);
      }
    } catch (e) {
      // ping RPC may not exist, continue with table query
    }
    
    // Query a table that should exist
    const { data, error } = await supabase
      .from('content_chunks')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Query failed:', error.message);
      console.error('Error details:', error);
      
      // Provide potential solutions
      console.log('\nPotential solutions:');
      
      if (error.message.includes('API key')) {
        console.log('- Your API key might be invalid. Get a fresh key from the Supabase dashboard.');
        console.log('- Check if the service role key has been revoked or regenerated.');
      }
      
      if (error.message.includes('does not exist')) {
        console.log('- The table "content_chunks" doesn\'t exist in this project.');
        console.log('- Check if you\'re connecting to the correct Supabase project.');
      }
      
      if (error.message.includes('JWT')) {
        console.log('- There might be an issue with your JWT token format.');
        console.log('- Get a fresh service role key from the Supabase dashboard.');
      }
      
      if (error.message.includes('network')) {
        console.log('- There might be network connectivity issues.');
        console.log('- Check your internet connection and firewall settings.');
      }
    } else {
      console.log('✅ Successfully connected to Supabase!');
      console.log(`Retrieved ${data.length} records from content_chunks table.`);
    }
  } catch (err) {
    console.error('❌ Exception occurred:', err.message);
  }
}

// Run the test
testConnection(); 