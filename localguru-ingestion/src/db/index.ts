import schema, { calculateContentChecksum, applyDatabaseUpdates } from './schema';
import operations from './operations';
import { DBHandler } from './db-handler';

// Re-export all the database functionality
export { 
  calculateContentChecksum,
  applyDatabaseUpdates
};

export const supabase = schema.supabase;

export type { 
  RedditPost, 
  RedditComment, 
  EmbeddingQueueItem 
} from './schema';

// Export all the database operations
export const {
  addPosts,
  addComments,
  getPostsForChecking,
  getCommentsForChecking,
  hasPostChanges,
  updatePost,
  addToEmbeddingQueue,
  getNextQueueBatch,
  markQueueItemsAsProcessing,
  markQueueItemAsCompleted,
  markQueueItemAsFailed,
  resetStuckProcessingJobs,
  pruneCompletedJobs,
  trimQueueToSize
} = operations;

// Export a default object with all functionality
export default {
  ...operations,
  supabase,
  applyDatabaseUpdates,
  calculateContentChecksum
};

export { DBHandler }; 