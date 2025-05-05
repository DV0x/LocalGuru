/** @type {import('next').NextConfig} */
const path = require('path');
const dotenv = require('dotenv');

// Explicitly load environment variables for Next.js
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const nextConfig = {
  reactStrictMode: true,
  
  // Tell Next.js to transpile the app/lib directory
  transpilePackages: ['app/lib'],
  
  // Configure path resolution
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Set up enhanced path resolution
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        '@/app': path.resolve(__dirname, 'app'),
        '@/app/lib': path.resolve(__dirname, 'app/lib'),
        '@/app/lib/utils': path.resolve(__dirname, 'app/lib/utils'),
        '@/app/lib/search': path.resolve(__dirname, 'app/lib/search'),
        '@/app/lib/supabase': path.resolve(__dirname, 'app/lib/supabase'),
        '@/app/lib/llm': path.resolve(__dirname, 'app/lib/llm'),
        '@/components': path.resolve(__dirname, 'components')
      }
    };
    
    // Ensure files in app/lib are properly processed
    config.module.rules.push({
      test: /\.(js|ts|tsx)$/,
      include: [
        path.resolve(__dirname, 'app/lib'),
      ],
      use: defaultLoaders.babel,
    });
    
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