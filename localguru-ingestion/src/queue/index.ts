import { DeprecatedQueueManager } from './queue-manager';

// QueueManager is deprecated - we now rely on database triggers
// If you need to manage queue items, use database functions or views
// See supabase/migrations/20240303085000_create_utility_functions.sql
export { DeprecatedQueueManager }; 