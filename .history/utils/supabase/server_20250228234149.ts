import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import type { CookieOptions } from '@supabase/supabase-js'

// This function creates a new Supabase client for server components
export async function getServerSupabaseClient() {
  const cookieStore = cookies()
  
  // Get auth cookie if it exists
  const supabaseAuthCookie = cookieStore.get('sb-auth-token')?.value
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        // If we have an auth cookie, include it in the request headers
        ...(supabaseAuthCookie && {
          global: {
            headers: {
              Authorization: `Bearer ${supabaseAuthCookie}`,
            },
          },
        }),
      },
    }
  )
}

// This function creates a Supabase client for server actions
export async function getServerActionSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
} 