import { createClient } from '@supabase/supabase-js';

// Log environment variables status (without exposing actual values)
console.log('Supabase environment variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL defined:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY defined:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Initialize the Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
); 