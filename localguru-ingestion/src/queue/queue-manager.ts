import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

interface QueueConfig {
  priorityMapping: Record<string, number>;
  defaultPriority: number;
  maxQueueSize: number;
  cooldownMinutes: number;
}

interface QueueItem {
  id: string;
  type: 'post' | 'comment' | 'updated_post' | 'updated_comment';
  subreddit: string;
}

/**
 * DEPRECATED: This QueueManager is no longer used. 
 * We now rely on database triggers to automatically add items to the util.embedding_queue table.
 * 
 * If you need to manually manage queue items, use database functions or views.
 * See supabase/migrations/20240303085000_create_utility_functions.sql for details.
 */
export class DeprecatedQueueManager {
  private supabase: any;
  private config: QueueConfig;
  private logger: Logger;
  
  constructor(supabaseUrl: string, supabaseKey: string, config: QueueConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    
    this.config = {
      priorityMapping: config.priorityMapping || {
        post: 8,
        comment: 5,
        updated_post: 9,
        updated_comment: 6
      },
      defaultPriority: config.defaultPriority || 5,
      maxQueueSize: config.maxQueueSize || 10000,
      cooldownMinutes: config.cooldownMinutes || 60
    };
    
    this.logger = new Logger('QueueManager');
  }
  
  // Calculate priority for a queue item
  calculatePriority(item: QueueItem): number {
    // Base priority from content type
    const priority = this.config.priorityMapping[item.type] || this.config.defaultPriority;
    
    // Ensure priority is within limits (1-10)
    return Math.min(Math.max(priority, 1), 10);
  }
  
  // Add a cooldown timestamp for this item
  private getCooldownTimestamp(): Date {
    const now = new Date();
    now.setMinutes(now.getMinutes() + this.config.cooldownMinutes);
    return now;
  }
  
  // Queue a single item for embedding
  async queueItemForEmbedding(item: QueueItem): Promise<boolean> {
    try {
      this.logger.debug(`Checking to queue item: ${item.id} (${item.type})`);
      
      const isUpdate = item.type === 'updated_post' || item.type === 'updated_comment';
      const contentType = item.type.includes('post') ? 'post' : 'comment';
      const tableName = contentType === 'post' ? 'reddit_posts' : 'reddit_comments';
      
      // Calculate priority
      const priority = this.calculatePriority(item);
      
      // Check if item already exists in queue using RPC function
      const { data: existsData, error: existsError } = await this.supabase
        .rpc('check_queue_item_exists', { 
          item_type: contentType, 
          item_id: item.id 
        });
      
      if (existsError) {
        throw existsError;
      }
      
      const exists = existsData || false;
      
      if (exists) {
        // Item already exists, update priority if needed
        const { data: updateData, error: updateError } = await this.supabase
          .rpc('update_queue_item_priority', {
            item_type: contentType,
            item_id: item.id,
            new_priority: priority
          });
        
        if (updateError) {
          throw updateError;
        }
        
        this.logger.debug(`Updated priority for existing queue item: ${item.id}`);
        return false;
      }
      
      // Add new queue item using RPC function
      const { data: insertData, error: insertError } = await this.supabase
        .rpc('add_to_embedding_queue', {
          item_type: contentType,
          item_id: item.id,
          item_priority: priority
        });
      
      if (insertError) {
        throw insertError;
      }
      
      this.logger.debug(`Queued item for embedding: ${item.id} (${item.type}, priority: ${priority})`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error queueing item for embedding: ${errorMessage}`);
      return false;
    }
  }
  
  // Queue multiple items in batch
  async queueBatch(items: QueueItem[]): Promise<number> {
    this.logger.info(`Queueing batch of ${items.length} items for embedding`);
    
    let successCount = 0;
    
    // Queue items one by one to handle duplication checks
    for (const item of items) {
      const success = await this.queueItemForEmbedding(item);
      if (success) successCount++;
    }
    
    this.logger.info(`Successfully queued ${successCount} new items for embedding`);
    return successCount;
  }
  
  // Clean up the queue (remove old completed items, reset stuck items)
  async cleanupQueue(): Promise<void> {
    this.logger.info('Performing queue cleanup');
    
    try {
      // Reset items stuck in "processing" state for too long (1 hour)
      const { error: resetError } = await this.supabase
        .rpc(
          'reset_stuck_processing_jobs',
          { max_processing_time_minutes: 60 }
        );
      
      if (resetError) throw resetError;
      
      // Delete old completed jobs (keep last 1000)
      const { error: pruneError } = await this.supabase
        .rpc(
          'prune_completed_jobs',
          { keep_count: 1000 }
        );
      
      if (pruneError) throw pruneError;
      
      // Remove items over max queue size (keeping highest priority)
      const { error: trimError } = await this.supabase
        .rpc(
          'trim_queue_to_size',
          { max_size: this.config.maxQueueSize }
        );
      
      if (trimError) throw trimError;
      
      this.logger.info('Queue cleanup completed successfully');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Error during queue cleanup: ${errorMessage}`, errorObj);
      throw errorObj;
    }
  }
} 