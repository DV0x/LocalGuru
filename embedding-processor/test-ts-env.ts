// test-ts-env.ts
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load env variables using the same method as the source files
dotenv.config();

console.log('===== TypeScript Environment Test =====');
console.log('TypeScript Node.js version:', process.version);
console.log('Current working directory:', process.cwd());

// Check DATABASE_URL from process.env
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  console.log('DATABASE_URL is set in process.env');
  
  // Safely print parts without exposing credentials
  const parts = dbUrl.split('@');
  if (parts.length > 1) {
    const hostPart = parts[1];
    const userPart = parts[0].split(':')[0];
    console.log('- Host part:', hostPart);
    console.log('- User part:', userPart);
    
    // Check if @ in password is properly encoded
    const hasEncodedAt = parts[0].includes('%40');
    console.log('- Contains encoded @ (%40):', hasEncodedAt);
  }
} else {
  console.log('DATABASE_URL is NOT set in process.env');
}

// Try direct connection to test
const fixedUrl = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function testConnections() {
  console.log('\nTesting TypeScript database connections:');
  
  // First with direct connection string
  console.log('\n1. Testing with hardcoded connection string:');
  const pool1 = new Pool({ connectionString: fixedUrl });
  try {
    const client1 = await pool1.connect();
    console.log('✅ Direct connection successful');
    client1.release();
    await pool1.end();
  } catch (err: any) {
    console.error('❌ Direct connection failed:', err.message);
  }
  
  // Then with env variable
  console.log('\n2. Testing with process.env.DATABASE_URL:');
  const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client2 = await pool2.connect();
    console.log('✅ ENV connection successful');
    client2.release();
    await pool2.end();
  } catch (err: any) {
    console.error('❌ ENV connection failed:', err.message);
  }
}

testConnections().catch(err => {
  console.error('Error in test:', err);
}); 