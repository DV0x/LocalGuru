// Simple script to print environment variables
const fs = require('fs');
require('dotenv').config();

const envVars = {
  'SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not found',
  'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY || 'Not found',
};

console.log('Environment Variables:');
console.log(JSON.stringify(envVars, null, 2));

// Create a temporary .env.test file with the correct variable names
const envContent = `
SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}
SUPABASE_SERVICE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY}
REDDIT_USER_AGENT=LocalGuru/1.0
REDDIT_REQUEST_DELAY=2000
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=false
`;

fs.writeFileSync('.env.test', envContent);
console.log('Created .env.test file with correct variable names'); 