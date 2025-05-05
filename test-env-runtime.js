
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

console.log('Loaded environment variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 'Not set');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length : 'Not set');

// Check if keys match what's in .env.local
const envVars = dotenv.parse(require('fs').readFileSync(envPath));
console.log('\nMatching with .env.local:');
console.log('SUPABASE_URL matches:', process.env.SUPABASE_URL === envVars.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY matches:', process.env.SUPABASE_SERVICE_ROLE_KEY === envVars.SUPABASE_SERVICE_ROLE_KEY);
console.log('NEXT_PUBLIC_SUPABASE_URL matches:', process.env.NEXT_PUBLIC_SUPABASE_URL === envVars.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY matches:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);
