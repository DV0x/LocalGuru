const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Path to the .env files
const envFilePath = path.resolve(process.cwd(), '.env');
const envLocalFilePath = path.resolve(process.cwd(), '.env.local');

// Current configuration
console.log('LocalGuru Automatic Connection Fix Tool');
console.log('======================================');
console.log('\nCurrent Configuration:');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'Not set'}`);

// Function to fix connection string
function fixConnectionString(connectionString) {
  try {
    // Extract connection parts using regex
    const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (!match) {
      console.log('❌ Could not parse connection string format');
      return null;
    }
    
    const [, username, password, host, port, database] = match;
    
    // Properly encode the password with URL encoding
    const encodedPassword = encodeURIComponent(password);
    
    // Rebuild the connection string
    const fixedString = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}`;
    
    console.log('✅ Fixed connection string with proper URL encoding');
    return fixedString;
  } catch (error) {
    console.error('❌ Error fixing connection string:', error.message);
    return null;
  }
}

// Function to update connection strings in environment files
function updateConnectionStrings(filePath, newDbUrl) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist. Skipping.`);
      return false;
    }

    // Read the file content
    let content = fs.readFileSync(filePath, 'utf8');
    let updates = 0;
    
    // Update DATABASE_URL
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL=${newDbUrl}$1`);
      updates++;
    } else {
      content += `\n# Database connection string\nDATABASE_URL=${newDbUrl}\n`;
      updates++;
    }
    
    // Update SUPABASE_DB_URL
    if (content.includes('SUPABASE_DB_URL=')) {
      content = content.replace(/SUPABASE_DB_URL=.*(\r?\n|$)/g, `SUPABASE_DB_URL=${newDbUrl}$1`);
      updates++;
    } else {
      content += `SUPABASE_DB_URL=${newDbUrl}\n`;
      updates++;
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath} with ${updates} changes`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Main function
function main() {
  // Get current connection string
  const currentDbUrl = process.env.DATABASE_URL;
  
  if (!currentDbUrl) {
    console.log('❌ No DATABASE_URL found in environment variables');
    console.log('Please check your .env and .env.local files');
    return;
  }
  
  // Check if it contains an unencoded @ symbol
  if (currentDbUrl.includes('@') && !currentDbUrl.includes('%40')) {
    console.log('⚠️ Detected potentially unencoded special characters in your database password!');
    
    // Fix the connection string
    const fixedDbUrl = fixConnectionString(currentDbUrl);
    
    if (!fixedDbUrl) {
      console.log('❌ Failed to fix connection string');
      return;
    }
    
    // Update both .env files
    const env1Updated = updateConnectionStrings(envFilePath, fixedDbUrl);
    const env2Updated = updateConnectionStrings(envLocalFilePath, fixedDbUrl);
    
    if (env1Updated || env2Updated) {
      console.log('\n✅ Database connection string has been fixed in environment files!');
      console.log('\nNext steps:');
      console.log('1. For Supabase API key issues, go to your Supabase dashboard');
      console.log('2. Get fresh API keys from Project Settings > API');
      console.log('3. Update your .env and .env.local files with the new keys');
      console.log('4. Restart your application for the changes to take effect');
    } else {
      console.log('❌ Failed to update environment files');
    }
  } else {
    console.log('✅ Database connection string appears to be properly encoded');
    console.log('\nIf you\'re still having issues:');
    console.log('1. Check that your API keys are valid and up to date');
    console.log('2. Make sure your IP address is allowed in the Supabase Database settings');
    console.log('3. Verify that your Supabase project is active');
  }
}

// Execute the main function
main(); 