const fs = require('fs');
const path = require('path');

// Path to the .env file
const envFilePath = path.resolve(process.cwd(), '.env');
const envLocalFilePath = path.resolve(process.cwd(), '.env.local');

// The connection details - ensure @ in password is properly encoded
const project = 'ghjbtvyalvigvmuodaas';
const username = 'postgres.' + project;
const password = encodeURIComponent('ch@924880194792'); // URL encode special characters
const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const port = '5432';
const database = 'postgres';

// Properly formatted connection string
const dbConnectionString = `postgresql://${username}:${password}@${host}:${port}/${database}`;

// Function to update a specific .env file
function updateEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`${filePath} does not exist. Skipping.`);
      return;
    }

    // Read the current .env file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if DATABASE_URL already exists
    if (content.includes('DATABASE_URL=')) {
      // Replace the existing DATABASE_URL
      content = content.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL=${dbConnectionString}$1`);
    } else {
      // Add DATABASE_URL if it doesn't exist
      content += `\n# Database connection string\nDATABASE_URL=${dbConnectionString}\n`;
    }
    
    // Check if SUPABASE_DB_URL already exists
    if (content.includes('SUPABASE_DB_URL=')) {
      // Replace the existing SUPABASE_DB_URL
      content = content.replace(/SUPABASE_DB_URL=.*(\r?\n|$)/g, `SUPABASE_DB_URL=${dbConnectionString}$1`);
    } else {
      // Add SUPABASE_DB_URL if it doesn't exist
      content += `SUPABASE_DB_URL=${dbConnectionString}\n`;
    }
    
    // Write the updated content back to the .env file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} with the new connection string.`);
    console.log(`New connection string: ${dbConnectionString}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
}

// Update both .env and .env.local files
updateEnvFile(envFilePath);
updateEnvFile(envLocalFilePath);

console.log('Environment files have been updated with the properly encoded connection string.'); 