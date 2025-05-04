require('dotenv').config();
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// First, let's patch the connection string in memory (without modifying the file)
const fixedConnectionString = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

// Create a patched .env file for our processes to use
const envFile = path.join(process.cwd(), '.env');
let envContent = '';

try {
  envContent = fs.readFileSync(envFile, 'utf8');
  
  // Replace the DATABASE_URL line
  envContent = envContent.replace(
    /DATABASE_URL=.*/,
    `DATABASE_URL=${fixedConnectionString}`
  );
  
  // Write to a temporary file
  const patchedEnvFile = path.join(process.cwd(), '.env.patched');
  fs.writeFileSync(patchedEnvFile, envContent);
  
  console.log(`✅ Created patched .env file with fixed connection string`);
} catch (err) {
  console.error('Error patching .env file:', err);
  process.exit(1);
}

// Start a single queue processor to test
console.log('\n===== Testing patched queue processor =====');

// Spawn the process-queue command with patched .env
const env = { ...process.env, DATABASE_URL: fixedConnectionString };
const process1 = spawn('npm', ['run', 'process-queue', '1'], {
  env,
  stdio: 'inherit'
});

process1.on('close', (code) => {
  console.log(`\nProcessor exited with code ${code}`);
  
  if (code === 0) {
    console.log('✅ Queue processor ran successfully!');
    console.log('\nYou can now run the full start-processors.ts script with the patched environment:');
    console.log('DATABASE_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" npm run start-processors');
  } else {
    console.log('❌ Queue processor failed. Check the error messages above.');
  }
}); 