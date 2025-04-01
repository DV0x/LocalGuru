import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { RedditPost, RedditComment, EmbeddingQueueItem, calculateContentChecksum } from './schema';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  db: {
    schema: 'public'
  }
});

/**
 * Add a batch of posts to the database
 */
export const addPosts = async (posts: Partial<RedditPost>[]): Promise<void> => {
  if (!posts.length) return;
  
  // Process posts in batches
  for (let i = 0; i < posts.length; i += config.database.batchSize) {
    const batch = posts.slice(i, i + config.database.batchSize);
    
    // Add checksum to each post
    for (const post of batch) {
      if (post.original_json) {
        post.content_checksum = calculateContentChecksum(post.original_json);
      }
    }
    
    // Insert the batch
    const { error } = await supabase
      .from('reddit_posts')
      .upsert(batch, { onConflict: 'id' });
      
    if (error) {
      console.error('Error adding posts:', error);
      throw error;
    }
  }
};

/**
 * Add a batch of comments to the database
 */
export const addComments = async (comments: Partial<RedditComment>[]): Promise<void> => {
  if (!comments.length) return;
  
  // Process comments in batches
  for (let i = 0; i < comments.length; i += config.database.batchSize) {
    const batch = comments.slice(i, i + config.database.batchSize);
    
    // Add checksum to each comment
    for (const comment of batch) {
      if (comment.original_json) {
        comment.content_checksum = calculateContentChecksum(comment.original_json);
      }
    }
    
    // Insert the batch
    const { error } = await supabase
      .from('reddit_comments')
      .upsert(batch, { onConflict: 'id' });
      
    if (error) {
      console.error('Error adding comments:', error);
      throw error;
    }
  }
};

/**
 * Get posts that need to be checked for updates
 */
export const getPostsForChecking = async (limit: number = 100): Promise<RedditPost[]> => {
  const { data, error } = await supabase
    .from('reddit_posts')
    .select('*')
    .is('is_removed', false)
    .order('last_checked', { ascending: true })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching posts for checking:', error);
    throw error;
  }
  
  return data || [];
};

/**
 * Get comments that need to be checked for updates
 */
export const getCommentsForChecking = async (limit: number = 100): Promise<RedditComment[]> => {
  const { data, error } = await supabase
    .from('reddit_comments')
    .select('*')
    .is('is_removed', false)
    .order('last_checked', { ascending: true })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching comments for checking:', error);
    throw error;
  }
  
  return data || [];
};

/**
 * Check if a post has changes based on its checksum
 */
export const hasPostChanges = (
  post: RedditPost, 
  newData: Record<string, any>,
  fields: string[] = config.changeDetection.checksumFields
): boolean => {
  if (!post.content_checksum) return true;
  
  const newChecksum = calculateContentChecksum(newData, fields);
  return post.content_checksum !== newChecksum;
};

/**
 * Update a post with new data and manage change tracking
 */
export const updatePost = async (
  post: RedditPost,
  newData: Record<string, any>
): Promise<void> => {
  // Calculate new checksum
  const newChecksum = calculateContentChecksum(newData);
  
  // Update post with the new data
  const updateData = {
    ...newData,
    content_checksum: newChecksum,
    last_checked: new Date(),
    update_count: (post.update_count || 0) + 1
  };
  
  const { error } = await supabase
    .from('reddit_posts')
    .update(updateData)
    .eq('id', post.id);
    
  if (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

/**
 * Add an item to the embedding queue
 */
export const addToEmbeddingQueue = async (
  item: Partial<EmbeddingQueueItem>
): Promise<void> => {
  const { error } = await supabase
    .from('util.embedding_queue')
    .insert([{
      ...item,
      created_at: new Date(),
      status: 'pending',
      attempts: 0
    }]);
    
  if (error) {
    console.error('Error adding to embedding queue:', error);
    throw error;
  }
};

/**
 * Get the next batch of items from the embedding queue
 */
export const getNextQueueBatch = async (
  batchSize: number = config.processQueue.batchSize
): Promise<EmbeddingQueueItem[]> => {
  const { data, error } = await supabase
    .from('util.embedding_queue')
    .select('*')
    .eq('status', 'pending')
    .is('cooldown_until', null)
    .or('cooldown_until.lt.now()')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(batchSize);
    
  if (error) {
    console.error('Error fetching embedding queue:', error);
    throw error;
  }
  
  return data || [];
};

/**
 * Mark queue items as processing
 */
export const markQueueItemsAsProcessing = async (ids: number[]): Promise<void> => {
  if (!ids.length) return;
  
  const { error } = await supabase
    .from('util.embedding_queue')
    .update({
      status: 'processing',
      updated_at: new Date()
    })
    .in('id', ids);
    
  if (error) {
    console.error('Error marking queue items as processing:', error);
    throw error;
  }
};

/**
 * Mark a queue item as completed
 */
export const markQueueItemAsCompleted = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('util.embedding_queue')
    .update({
      status: 'completed',
      processed_at: new Date(),
      updated_at: new Date()
    })
    .eq('id', id);
    
  if (error) {
    console.error('Error marking queue item as completed:', error);
    throw error;
  }
};

/**
 * Mark a queue item as failed
 */
export const markQueueItemAsFailed = async (
  id: number,
  errorMessage: string
): Promise<void> => {
  const { error } = await supabase
    .from('util.embedding_queue')
    .update({
      status: 'failed',
      last_error: errorMessage,
      attempts: supabase.rpc('increment', { row_id: id, column_name: 'attempts' }),
      updated_at: new Date()
    })
    .eq('id', id);
    
  if (error) {
    console.error('Error marking queue item as failed:', error);
    throw error;
  }
};

/**
 * Reset stuck processing jobs in the queue
 */
export const resetStuckProcessingJobs = async (
  maxProcessingTimeMinutes: number = 60
): Promise<number> => {
  const { data, error } = await supabase
    .rpc('reset_stuck_processing_jobs', { max_processing_time_minutes: maxProcessingTimeMinutes });
    
  if (error) {
    console.error('Error resetting stuck jobs:', error);
    throw error;
  }
  
  return data || 0;
};

/**
 * Prune completed jobs from the queue
 */
export const pruneCompletedJobs = async (
  keepCount: number = 1000
): Promise<number> => {
  const { data, error } = await supabase
    .rpc('prune_completed_jobs', { keep_count: keepCount });
    
  if (error) {
    console.error('Error pruning completed jobs:', error);
    throw error;
  }
  
  return data || 0;
};

/**
 * Trim the queue to the maximum size
 */
export const trimQueueToSize = async (
  maxSize: number = config.queue.maxQueueSize
): Promise<number> => {
  const { data, error } = await supabase
    .rpc('trim_queue_to_size', { max_size: maxSize });
    
  if (error) {
    console.error('Error trimming queue:', error);
    throw error;
  }
  
  return data || 0;
};

export default {
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
}; 