/**
 * Local Supabase client for the embeddings API route
 */

import { createClient } from '@supabase/supabase-js';

// Define fallback values for deployment environments
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Edge runtime compatibility check
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase server-side credentials. Please check your environment variables.');
}

/**
 * Server-side Supabase client with admin privileges (service role)
 * For use in this API route only
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
); 