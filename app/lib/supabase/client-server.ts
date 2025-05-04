import { createClient } from '@supabase/supabase-js';

// Define fallback values for deployment environments
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Edge runtime compatibility check
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase server-side credentials. Please check your environment variables.');
}

/**
 * Server-side Supabase client with admin privileges (service role)
 * IMPORTANT: This client should ONLY be used server-side
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

/**
 * Helper function to create a client with the anon key when service role is not needed
 * Still only for server-side use
 */
export function createServerSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase anon credentials. Please check your environment variables.');
  }
  
  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

/**
 * Function to check if the Supabase service is available
 * Useful for health checks
 */
export async function checkSupabaseConnection() {
  try {
    // Using a simple RPC call as a health check
    const { error } = await supabaseAdmin.rpc('ping');
    return { ok: !error, error: error?.message };
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 