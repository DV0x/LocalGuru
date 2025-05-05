require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define paths
const supabaseFunctionsDir = path.join(__dirname, 'supabase', 'functions');

// Get environment variables needed for Edge Functions
const envVars = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  CUSTOM_SUPABASE_URL: process.env.SUPABASE_URL // Set this to the same as SUPABASE_URL
};

// Validate environment variables
const missingVars = Object.entries(envVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Find all Edge Function directories
const functionDirs = fs.readdirSync(supabaseFunctionsDir)
  .filter(item => {
    const itemPath = path.join(supabaseFunctionsDir, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('_');
  });

console.log(`Found ${functionDirs.length} Edge Functions to deploy:`, functionDirs);

// Deploy each Edge Function with environment variables
for (const functionName of functionDirs) {
  try {
    console.log(`\nDeploying ${functionName}...`);
    
    // Build the environment variables string for the command
    const envVarsString = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    
    // Run the Supabase CLI command to deploy the function
    const command = `supabase functions deploy ${functionName} --project-ref ${process.env.SUPABASE_PROJECT} --no-verify-jwt`;
    
    // Execute with environment variables
    console.log(`Running: ${command} (with env vars)`);
    execSync(`${envVarsString} ${command}`, { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    console.log(`✅ ${functionName} deployed successfully`);
  } catch (error) {
    console.error(`❌ Failed to deploy ${functionName}:`, error.message);
  }
}

console.log('\nAll functions deployed. Testing Edge Function...');

// Optional: Test query-analysis edge function
try {
  console.log('\nTesting query-analysis Edge Function...');
  
  const testCommand = `curl -X POST "${process.env.SUPABASE_URL}/functions/v1/query-analysis" \\
  -H "Authorization: Bearer ${process.env.SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "test query"}'`;
  
  console.log('You can test the function with:');
  console.log(testCommand);
} catch (error) {
  console.error('Error generating test command:', error.message);
}