const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Path to the .env files
const envFilePath = path.resolve(process.cwd(), '.env');
const envLocalFilePath = path.resolve(process.cwd(), '.env.local');

// Connection details with the correct password
const project = 'ghjbtvyalvigvmuodaas';
const username = 'postgres.' + project;
const password = 'ch@924880194792'; // Correct password
const encodedPassword = encodeURIComponent(password); // Properly encode the @ symbol
const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const port = '5432';
const database = 'postgres';

// Create the correctly formatted connection string
const correctDbUrl = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}`;

console.log('Fixing database connection string with correct password...');
console.log('New connection string starts with:', correctDbUrl.substring(0, 60) + '...');

// Function to update a file
function updateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist. Skipping.`);
      return;
    }

    // Read the file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update DATABASE_URL
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL=${correctDbUrl}$1`);
    } else {
      content += `\n# Database connection string\nDATABASE_URL=${correctDbUrl}\n`;
    }
    
    // Update SUPABASE_DB_URL
    if (content.includes('SUPABASE_DB_URL=')) {
      content = content.replace(/SUPABASE_DB_URL=.*(\r?\n|$)/g, `SUPABASE_DB_URL=${correctDbUrl}$1`);
    } else {
      content += `SUPABASE_DB_URL=${correctDbUrl}\n`;
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath} with correct connection string`);
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

// Update both files
updateFile(envFilePath);
updateFile(envLocalFilePath);

console.log('\n✅ Database connection strings have been updated with the correct password!');
console.log('Next step: restart your application to apply the changes');

// Test the connection
console.log('\nTesting connection...');
const { Pool } = require('pg');

async function testConnection() {
  const pool = new Pool({ connectionString: correctDbUrl });
  
  try {
    const result = await pool.query('SELECT 1 AS test');
    console.log('✅ Database connection successful!', result.rows);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('\nPossible issues:');
    console.log('1. Check if your IP address is allowed in Supabase database settings');
    console.log('2. Verify that the password is correct');
    console.log('3. Check if the database server is reachable');
  } finally {
    await pool.end();
  }
}

testConnection(); 