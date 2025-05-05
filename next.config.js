/** @type {import('next').NextConfig} */
const path = require('path');
const dotenv = require('dotenv');

// Explicitly load environment variables for Next.js
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const nextConfig = {
  reactStrictMode: true,
  
  // Configure path resolution - simplified approach
  webpack: (config, { defaultLoaders }) => {
    // Resolve paths using simpler configuration
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@/app': path.resolve(__dirname, 'app'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/components': path.resolve(__dirname, 'components')
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