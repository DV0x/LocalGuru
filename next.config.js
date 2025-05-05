/** @type {import('next').NextConfig} */
const path = require('path');
const dotenv = require('dotenv');

// Explicitly load environment variables for Next.js
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const nextConfig = {
  reactStrictMode: true,
  // Ensure CSS is handled correctly
  webpack: (config) => {
    return config;
  },
  env: {
    // Manually expose environment variables to the Next.js runtime
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  }
}
 
module.exports = nextConfig 