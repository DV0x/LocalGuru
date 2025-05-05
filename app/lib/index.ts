/**
 * This file helps with module resolution by re-exporting everything from the top-level lib
 * It ensures backward compatibility with existing @/app/lib imports
 */

// Re-export all utilities
export * from '@/lib/utils/api-response';
export * from '@/lib/utils/error-handling'; 
export * from '@/lib/utils/api-key-middleware';
export * from '@/lib/utils/csrf';
export * from '@/lib/utils/csrf-middleware';
export * from '@/lib/utils/api-key-validator';

// Re-export Supabase client
export * from '@/lib/supabase/client-server';
export * from '@/lib/supabase/types';

// Re-export search functionality
export * from '@/lib/search/query-processor';
export * from '@/lib/search/result-formatter';
export * from '@/lib/search/stream-processor';
export * from '@/lib/search/streaming-types';
export * from '@/lib/search/types';
