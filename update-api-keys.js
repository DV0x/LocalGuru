const fs = require('fs');
const path = require('path');

// New API keys from Supabase dashboard
const supabaseUrl = 'https://ghjbtvyalvigvmuodaas.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyOTY5MTQsImV4cCI6MjA2MTg3MjkxNH0.AUyFzddhM-ArYOMIVRwqYEcC_uZ1yICKS_NEZSZx6xE';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjI5NjkxNCwiZXhwIjoyMDYxODcyOTE0fQ.Od5n2z3rSl6isKORJonW8J4OlJSR8HvpD6MIKMiCzro';

// Fixed database URL with properly encoded password
const dbUrl = 'postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

// Environment files to update
const envFiles = [
  '.env',
  '.env.local',
  'embedding-processor/.env',
  'queue-processor/.env'
];

// Update API keys in environment files
function updateEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} doesn't exist, skipping.`);
      return false;
    }

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Update values
    content = content.replace(/NEXT_PUBLIC_SUPABASE_URL=.*/g, `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`);
    content = content.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/g, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`);
    content = content.replace(/SUPABASE_URL=.*/g, `SUPABASE_URL=${supabaseUrl}`);
    content = content.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/g, `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
    content = content.replace(/SUPABASE_ANON_KEY=.*/g, `SUPABASE_ANON_KEY=${anonKey}`);
    content = content.replace(/SUPABASE_DB_URL=.*/g, `SUPABASE_DB_URL=${dbUrl}`);
    content = content.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${dbUrl}`);
    
    // Remove duplicates
    const lines = content.split('\n');
    const uniqueLines = [];
    const keys = new Set();
    
    for (const line of lines) {
      const match = line.match(/^([^=]+)=/);
      if (!match || line.trim().startsWith('#')) {
        uniqueLines.push(line);
        continue;
      }
      
      const key = match[1];
      if (!keys.has(key)) {
        keys.add(key);
        uniqueLines.push(line);
      }
    }
    
    // Write updated content back to file
    fs.writeFileSync(filePath, uniqueLines.join('\n'), 'utf8');
    console.log(`✅ Updated ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Update all env files
console.log('Updating API keys in environment files...');
for (const file of envFiles) {
  updateEnvFile(path.resolve(process.cwd(), file));
}

console.log('\nAPI keys have been updated. Run the test connection script to verify:');
console.log('node test-connection.js');