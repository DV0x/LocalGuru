import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/supabase'

// Create a single supabase client for the entire client-side application
let supabaseClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient
  
  // Create a new client if one doesn't exist already
  supabaseClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    }
  )
  
  return supabaseClient
} 