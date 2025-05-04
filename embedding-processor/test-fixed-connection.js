require('dotenv').config();
const { Pool } = require('pg');

// Original connection string (likely broken due to @ in password)
const originalConnString = process.env.DATABASE_URL;
console.log('Original connection string:', originalConnString);

// Build a proper connection string with URL-encoded special characters
// Format: postgresql://username:password@host:port/database
const fixedConnString = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
console.log('Fixed connection string (with encoded @):', fixedConnString);

async function testFixedConnection() {
  console.log('\nTesting connection with fixed string...');
  
  const pool = new Pool({
    connectionString: fixedConnString
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW()');
    console.log('Query result:', result.rows[0]);
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Fix confirmed! You need to update your .env file with this connection string.');
  } catch (err) {
    console.error('❌ Connection still failed:', err.message);
  }
}

testFixedConnection(); 