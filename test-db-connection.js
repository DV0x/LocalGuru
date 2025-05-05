const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing connections with updated environment variables:');
console.log('=====================================================');

// Test Supabase client connection
async function testSupabaseConnection() {
  console.log('\n1. Testing Supabase client connection...');
  
  try {
    // Check if credentials exist
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase credentials in environment variables');
      return;
    }
    
    console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL.substring(0, 10)}...`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length} characters`);
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // Try a simple query
    const { data, error } = await supabase.from('content_chunks').select('id').limit(1);
    
    if (error) {
      console.error('❌ Supabase client connection failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Supabase client connection successful!');
      console.log(`Retrieved ${data.length} records`);
    }
  } catch (err) {
    console.error('❌ Exception in Supabase client test:', err.message);
  }
}

// Test direct PostgreSQL connection
async function testDatabaseConnection() {
  console.log('\n2. Testing direct PostgreSQL connection...');
  
  try {
    // Check if connection string exists
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL in environment variables');
      return;
    }
    
    console.log(`Connection string starts with: ${connectionString.substring(0, 30)}...`);
    
    // Initialize PostgreSQL connection
    const pool = new Pool({ connectionString });
    
    // Try a simple query
    const result = await pool.query('SELECT 1 AS test');
    
    if (result.rows && result.rows.length > 0) {
      console.log('✅ PostgreSQL connection successful!');
      console.log('Query result:', result.rows[0]);
      
      // Try a real table query
      try {
        const tableResult = await pool.query('SELECT COUNT(*) FROM content_chunks');
        console.log(`Content chunks count: ${tableResult.rows[0].count}`);
      } catch (tableErr) {
        console.error('Note: Could not count content_chunks but connection works:', tableErr.message);
      }
    } else {
      console.error('❌ PostgreSQL connection test failed: No results returned');
    }
    
    // Close the pool
    await pool.end();
  } catch (err) {
    console.error('❌ Exception in PostgreSQL connection test:', err.message);
  }
}

// Run the tests
async function runTests() {
  await testSupabaseConnection();
  await testDatabaseConnection();
  
  console.log('\n=====================================================');
  console.log('Connection tests completed.');
}

runTests(); 