require('dotenv').config();
const { Pool } = require('pg');

// Test the PG connection using DATABASE_URL from .env
async function testPgConnection() {
  console.log('Testing PostgreSQL connection...');
  
  // Extract and print parts of the connection string for debugging
  // (without showing the full password)
  const connString = process.env.DATABASE_URL;
  const connStringParts = connString.split('@');
  const userPart = connStringParts[0].split(':');
  const username = userPart[1].replace('//', '');
  
  console.log('Connection parts:');
  console.log('- Username:', username);
  console.log('- Host:', connStringParts[1].split(':')[0]);
  
  // Attempt to connect
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW()');
    console.log('Query result:', result.rows[0]);
    
    client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Full error:', err);
  }
}

testPgConnection(); 