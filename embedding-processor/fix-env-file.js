const fs = require('fs');
const path = require('path');

// The correct, URL-encoded connection string
const fixedConnectionString = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

// Path to the .env file
const envFile = path.join(process.cwd(), '.env');

// Create a backup of the original .env file
const backupFile = path.join(process.cwd(), '.env.backup');

try {
  // Read the current .env file
  const envContent = fs.readFileSync(envFile, 'utf8');
  
  // Create a backup
  fs.writeFileSync(backupFile, envContent);
  console.log(`✅ Created backup of original .env file at .env.backup`);
  
  // Replace the DATABASE_URL line with the fixed version
  const updatedContent = envContent.replace(
    /DATABASE_URL=.*/,
    `DATABASE_URL=${fixedConnectionString}`
  );
  
  // Write the updated content back to the .env file
  fs.writeFileSync(envFile, updatedContent);
  
  console.log(`✅ Successfully updated .env file with correctly encoded DATABASE_URL`);
  console.log(`\nYou can now run the processors directly without environment variable override:`);
  console.log(`npm run start-processors`);
} catch (err) {
  console.error('❌ Error updating .env file:', err.message);
} 