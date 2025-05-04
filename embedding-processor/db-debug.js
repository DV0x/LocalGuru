require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Debug paths and environment
console.log('===== Environment Debug =====');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Node.js version:', process.version);
console.log('DATABASE_URL from ENV:', process.env.DATABASE_URL ? 'Set (not showing for security)' : 'Not set');

// Check .env file
try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
  console.log('DATABASE_URL in .env file:', dbUrlLine ? 'Found' : 'Not found');
  
  // Parse and sanitize for display (show structure but hide credentials)
  if (dbUrlLine) {
    const urlParts = dbUrlLine.replace('DATABASE_URL=', '').split('@');
    if (urlParts.length > 1) {
      const credentials = urlParts[0].split(':');
      const sanitizedUrl = `postgresql://${credentials[0]}:***@${urlParts[1]}`;
      console.log('URL structure:', sanitizedUrl);
    }
  }
} catch (err) {
  console.log('Error reading .env file:', err.message);
}

// Create a pool manually with URL encoding fix
// This shows what a proper connection should look like
const explicitPool = new Pool({
  user: 'postgres.ghjbtvyalvigvmuodaas',
  password: 'ch@924880194792', // Note: In code we'd encode this as ch%40924880194792
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  ssl: true
});

// Try direct connection with fixed connection string
const fixedUrl = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
console.log('\nTrying direct connection with explicit parameters...');

async function testConnections() {
  // First test with explicit parameters
  try {
    const client1 = await explicitPool.connect();
    console.log('✅ Explicit connection successful');
    const res1 = await client1.query('SELECT current_database() as db');
    console.log('Database:', res1.rows[0].db);
    client1.release();
    await explicitPool.end();
  } catch (err) {
    console.error('❌ Explicit connection failed:', err.message);
  }
  
  // Test with fixed URL
  const urlPool = new Pool({ connectionString: fixedUrl });
  try {
    const client2 = await urlPool.connect();
    console.log('✅ Fixed URL connection successful');
    const res2 = await client2.query('SELECT now()');
    console.log('Server time:', res2.rows[0].now);
    client2.release();
    await urlPool.end();
  } catch (err) {
    console.error('❌ Fixed URL connection failed:', err.message);
  }
  
  // Test with URL exactly as in ENV
  const envPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client3 = await envPool.connect();
    console.log('✅ ENV URL connection successful');
    client3.release();
    await envPool.end();
  } catch (err) {
    console.error('❌ ENV URL connection failed:', err.message, '\n');
    if (err.message.includes('SASL')) {
      console.log('\n🔍 SASL error detected - this is likely due to the @ character in password not being URL encoded');
      console.log('The @ character in database passwords must be encoded as %40 in connection strings');
    }
  }
}

testConnections(); 