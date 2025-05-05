/** @type {import('next').NextConfig} */
const path = require('path');
const dotenv = require('dotenv');

// Explicitly load environment variables for Next.js
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const nextConfig = {
  reactStrictMode: true,
  
  // Configure path resolution
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Explicitly map paths from @/lib to @/app/lib
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/lib/utils': path.resolve(__dirname, 'app/lib/utils'),
      '@/lib/search': path.resolve(__dirname, 'app/lib/search'),
      '@/lib/supabase': path.resolve(__dirname, 'app/lib/supabase'),
      '@/lib/llm': path.resolve(__dirname, 'app/lib/llm'),
      '@/lib/prompts': path.resolve(__dirname, 'app/lib/prompts'),
      '@/lib/validators': path.resolve(__dirname, 'app/lib/validators')
    };
    
    return config;
  },
  
  // Skip TypeScript checking for excluded directories
  typescript: {
    ignoreBuildErrors: false, // Keep the type checking for other code
  },
  
  // Exclude directories from being statically analyzed
  experimental: {
    serverComponentsExternalPackages: ['dompurify'], // Add other packages if needed
  },
  
  // Safely expose environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
  }
}
 
module.exports = nextConfig 