import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

interface DBHandlerConfig {
  batchSize: number;
  retryAttempts: number;
  disableTriggers: boolean;
}

interface SupabaseErrorLog {
  code?: string;
  message: string;
  hint?: string | null;
  details?: any;
}

export class DBHandler {
  private supabase: any;
  private config: DBHandlerConfig;
  private logger: Logger;
  
  constructor(supabaseUrl: string, supabaseKey: string, config: DBHandlerConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.config = {
      batchSize: config.batchSize || 50,
      retryAttempts: config.retryAttempts || 3,
      disableTriggers: config.disableTriggers || false
    };
    
    this.logger = new Logger('DBHandler');
  }
  
  // Disable triggers for better performance during bulk operations
  async disableTriggers(): Promise<void> {
    this.logger.info('Disabling database triggers');
    
    try {
      // Disable for posts
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_posts',
        enable: false
      });
      
      // Disable for comments
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_comments',
        enable: false
      });
      
      this.logger.info('Triggers disabled successfully');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Error disabling triggers: ${errorMessage}`, errorObj);
      throw errorObj;
    }
  }
  
  // Re-enable triggers after operations
  async enableTriggers(): Promise<void> {
    this.logger.info('Re-enabling database triggers');
    
    try {
      // Enable for posts
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_posts',
        enable: true
      });
      
      // Enable for comments
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_comments',
        enable: true
      });
      
      this.logger.info('Triggers enabled successfully');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Error enabling triggers: ${errorMessage}`, errorObj);
      throw errorObj;
    }
  }
  
  // Utility function to retry operations on network failure
  private async retryOperation<T extends { data: any; error: any }>(
    operation: () => Promise<T>,
    retries = 5,
    initialDelay = 2000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        
        // More comprehensive check for network errors
        const isNetworkError = 
          (err instanceof Error && (
            err.message.includes('fetch failed') ||
            err.message.includes('network') ||
            err.message.includes('timeout') ||
            err.message.includes('connection') ||
            err.message.includes('socket')
          )) ||
          (typeof err === 'object' && err !== null && 
           'message' in err && typeof err.message === 'string' && (
            err.message.includes('fetch failed') ||
            err.message.includes('network') ||
            err.message.includes('timeout') ||
            err.message.includes('connection') ||
            err.message.includes('socket')
          ));
        
        if (attempt < retries) {
          const waitTime = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(
            `Operation failed (attempt ${attempt}/${retries}): ${
              err instanceof Error ? err.message : String(err)
            }. ${isNetworkError ? 'Network error detected. ' : ''}Retrying in ${waitTime/1000} seconds...`
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw err;
      }
    }
    
    throw lastError;
  }
  
  // Insert posts in batches
  async insertPosts(posts: any[]): Promise<string[]> {
    const insertedIds: string[] = [];
    // Use a smaller batch size for more reliable processing
    const batchSize = Math.min(this.config.batchSize, 20); // Ensure batch size is not too large
    
    this.logger.info(`Inserting ${posts.length} posts in batches of ${batchSize}`);
    
    try {
      // First, insert all users to avoid foreign key constraint violations
      await this.insertUsers(posts);
    } catch (err) {
      this.logger.error(`Failed to insert users for posts, cannot proceed with post insertion`);
      throw err;
    }
    
    // Process in batches
    for (let i = 0; i < posts.length; i += batchSize) {
      // Add a small pause between batches to prevent overwhelming the server
      if (i > 0) {
        this.logger.debug(`Pausing briefly before next batch to prevent rate limiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const batch = posts.slice(i, i + batchSize);
      
      try {
        // Set last_checked to now and remove search_vector field if it exists
        const postsWithTimestamp = batch.map(post => {
          // Create a new object omitting the search_vector field
          const { search_vector, ...postData } = post;
          
          return {
            ...postData,
            last_checked: new Date()
          };
        });
        
        this.logger.debug(`Inserting post batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)}`);
        
        // Use retry mechanism for network issues
        const { data, error } = await this.retryOperation(() => 
          this.supabase
            .from('reddit_posts')
            .insert(postsWithTimestamp)
            .select('id')
        );
        
        if (error) {
          const pgError = error as PostgrestError;
          this.logSupabaseError(pgError, `inserting posts batch ${Math.floor(i/batchSize) + 1}`);
          throw error;
        }
        
        const batchIds = data.map((item: any) => item.id);
        insertedIds.push(...batchIds);
        
        this.logger.info(`Successfully inserted post batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)}`);
      } catch (err: unknown) {
        let errorMessage = 'Unknown error';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          this.logger.error(`Error inserting post batch: ${errorMessage}`, err);
        } else if (typeof err === 'object' && err !== null) {
          try {
            errorMessage = JSON.stringify(err, null, 2);
          } catch {
            errorMessage = 'Error object could not be stringified';
          }
          this.logger.error(`Error inserting post batch: ${errorMessage}`);
        }
        
        // Log the problematic data for debugging
        this.logger.debug('Problematic post batch data:', {
          batchSize: batch.length,
          samplePost: batch[0] ? {
            id: batch[0].id,
            title: batch[0].title,
            content_length: batch[0].content?.length,
            fields: Object.keys(batch[0])
          } : null
        });
        
        // Create properly formatted error object with details
        const errorObj = new Error(`Database error during post insertion: ${errorMessage}`);
        throw errorObj;
      }
    }
    
    this.logger.info(`Inserted ${insertedIds.length} posts successfully`);
    return insertedIds;
  }
  
  // Update existing posts
  async updatePosts(posts: any[]): Promise<string[]> {
    const updatedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Updating ${posts.length} posts in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      // Update one by one to avoid conflicts
      for (const post of batch) {
        try {
          // Create a clean post object without search_vector
          const { search_vector, ...postToUpdate } = post;
          
          // Set last_checked to now
          postToUpdate.last_checked = new Date();
          
          const { error } = await this.retryOperation(() => 
            this.supabase
              .from('reddit_posts')
              .update(postToUpdate)
              .eq('id', post.id)
          );
          
          if (error) {
            const pgError = error as PostgrestError;
            this.logSupabaseError(pgError, `updating post ${post.id}`);
            throw pgError;
          }
          
          updatedIds.push(post.id);
        } catch (err: unknown) {
          let errorMessage = 'Unknown error';
          
          if (err instanceof PostgrestError) {
            errorMessage = `Database error: ${err.message} (${err.code})`;
            this.logSupabaseError(err, `updating post ${post.id}`);
          } else if (err instanceof Error) {
            errorMessage = err.message;
            this.logger.error(`Error updating post ${post.id}: ${errorMessage}`, err);
          } else if (typeof err === 'object' && err !== null) {
            try {
              errorMessage = JSON.stringify(err, null, 2);
            } catch {
              errorMessage = 'Error object could not be stringified';
            }
            this.logger.error(`Error updating post ${post.id}: ${errorMessage}`);
          }
          
          // Continue with other posts instead of failing the entire batch
          this.logger.warn(`Skipping post update for ${post.id} due to error: ${errorMessage}`);
          continue;
        }
      }
      
      this.logger.info(`Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)}`);
      
      // Add a small pause between batches
      if (i + batchSize < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.logger.info(`Updated ${updatedIds.length}/${posts.length} posts successfully`);
    return updatedIds;
  }
  
  // Extract and insert users from the provided batch of posts or comments
  async insertUsers(items: any[]): Promise<Set<string>> {
    const userIds = new Set<string>();
    
    // Extract unique user IDs from posts or comments
    for (const item of items) {
      if (item.author_id && typeof item.author_id === 'string' && item.author_id !== '[deleted]') {
        userIds.add(item.author_id);
      }
    }
    
    const uniqueUserIds = Array.from(userIds);
    if (uniqueUserIds.length === 0) {
      return userIds;
    }
    
    this.logger.info(`Preparing to insert ${uniqueUserIds.length} unique users`);
    
    try {
      // Split user IDs into smaller chunks for querying existing users
      const queryBatchSize = 100; // Smaller batch size for queries
      const existingUserIds = new Set<string>();
      
      // Query existing users in smaller batches
      for (let i = 0; i < uniqueUserIds.length; i += queryBatchSize) {
        const batchIds = uniqueUserIds.slice(i, i + queryBatchSize);
        
        this.logger.debug(`Checking existing users batch ${Math.floor(i/queryBatchSize) + 1}/${Math.ceil(uniqueUserIds.length/queryBatchSize)}`);
        
        // Add a small pause between batches to avoid overwhelming the network
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        try {
          const { data, error } = await this.retryOperation(() => 
            this.supabase
              .from('reddit_users')
              .select('id')
              .in('id', batchIds)
          );
          
          if (error) {
            this.logger.error(`Error checking existing users batch: ${error.message}`);
            throw error;
          }
          
          // Add existing users to the set
          if (data && data.length > 0) {
            data.forEach((user: any) => existingUserIds.add(user.id));
          }
        } catch (err) {
          this.logger.error(`Failed to check existing users batch: ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      }
      
      // Filter out users that already exist
      const newUserIds = uniqueUserIds.filter(id => !existingUserIds.has(id));
      
      if (newUserIds.length === 0) {
        this.logger.info('All users already exist in the database');
        return userIds;
      }
      
      this.logger.info(`Found ${existingUserIds.size} existing users, will insert ${newUserIds.length} new users`);
      
      // Prepare user records for insertion
      const userRecords = newUserIds.map(id => ({
        id,
        username: id,
        created_at: new Date()
      }));
      
      // Use even smaller batches for insertion to reduce chances of network failures
      const userBatchSize = 25; // Further reduced batch size
      
      for (let i = 0; i < userRecords.length; i += userBatchSize) {
        const userBatch = userRecords.slice(i, i + userBatchSize);
        
        this.logger.debug(`Inserting user batch ${Math.floor(i/userBatchSize) + 1}/${Math.ceil(userRecords.length/userBatchSize)}`);
        
        // Add a small pause between batches to avoid overwhelming the network
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        try {
          const { error: insertError } = await this.retryOperation(() => 
            this.supabase
              .from('reddit_users')
              .upsert(userBatch, { onConflict: 'id' })
          );
          
          if (insertError) {
            this.logger.error(`Error inserting user batch ${Math.floor(i/userBatchSize) + 1}: ${insertError.message}`);
            throw insertError;
          }
          
          this.logger.info(`Successfully inserted user batch ${Math.floor(i/userBatchSize) + 1}/${Math.ceil(userRecords.length/userBatchSize)}`);
        } catch (err) {
          this.logger.error(`Failed to insert user batch ${Math.floor(i/userBatchSize) + 1}: ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      }
      
      this.logger.info(`Successfully inserted ${newUserIds.length} new users`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Error handling users: ${errorMessage}`);
      throw new Error(`Failed to insert users: ${errorMessage}`);
    }
    
    return userIds;
  }
  
  private logSupabaseError(error: PostgrestError, context: string) {
    let errorDetails: any = {
      message: error.message || 'Unknown error'
    };
    
    // Safely extract error details
    if (error.code) errorDetails.code = error.code;
    if (error.hint) errorDetails.hint = error.hint;
    if (error.details) errorDetails.details = typeof error.details === 'string' ? error.details : JSON.stringify(error.details);
    
    try {
      this.logger.error(`Supabase error ${context}: ${error.message}`, errorDetails);
    } catch (err) {
      this.logger.error(`Supabase error ${context}: Error details could not be logged properly`, new Error('Error logging failed'));
    }
  }
  
  // Insert comments in batches
  async insertComments(comments: any[]): Promise<string[]> {
    const insertedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Inserting ${comments.length} comments in batches of ${batchSize}`);
    
    try {
      // First, insert all users to avoid foreign key constraint violations
      await this.insertUsers(comments);
    } catch (err) {
      this.logger.error(`Failed to insert users for comments, cannot proceed with comment insertion`);
      throw err;
    }
    
    // Process in batches
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      try {
        // Set last_checked to now and remove search_vector field if it exists
        const commentsWithTimestamp = batch.map(comment => {
          // Create a new object omitting the search_vector field
          const { search_vector, ...commentData } = comment;
          
          return {
            ...commentData,
            last_checked: new Date()
          };
        });
        
        // Use retry mechanism for network issues
        const { data, error } = await this.retryOperation(() => 
          this.supabase
            .from('reddit_comments')
            .insert(commentsWithTimestamp)
            .select('id')
        );
        
        if (error) {
          // Log the full error details for Supabase errors
          const pgError = error as PostgrestError;
          this.logSupabaseError(pgError, 'inserting comments');
          
          // Log the problematic data
          this.logger.debug('Problematic comment batch:', {
            batchSize: batch.length,
            sampleComment: batch[0] ? {
              id: batch[0].id,
              post_id: batch[0].post_id,
              content_length: batch[0].content?.length,
              fields: Object.keys(batch[0])
            } : null
          });
          
          throw error;
        }
        
        const batchIds = data.map((item: any) => item.id);
        insertedIds.push(...batchIds);
        
        this.logger.info(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(comments.length/batchSize)}`);
      } catch (err: unknown) {
        let errorMessage = 'Unknown error';
        
        if (err instanceof PostgrestError) {
          errorMessage = `Database error: ${err.message} (${err.code})`;
          this.logSupabaseError(err, 'in batch');
        } else if (err instanceof Error) {
          errorMessage = err.message;
          this.logger.error(`Error inserting comments: ${errorMessage}`, err);
        } else if (typeof err === 'object' && err !== null) {
          try {
            errorMessage = JSON.stringify(err, null, 2);
          } catch {
            errorMessage = 'Error object could not be stringified';
          }
          this.logger.error(`Error inserting comments: ${errorMessage}`);
        }
        
        // Continue with next batch instead of throwing
        this.logger.warn('Skipping problematic batch and continuing...');
        continue;
      }
    }
    
    this.logger.info(`Inserted ${insertedIds.length} comments successfully`);
    return insertedIds;
  }
  
  // Update existing comments
  async updateComments(comments: any[]): Promise<string[]> {
    const updatedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Updating ${comments.length} comments in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      // Update one by one to avoid conflicts
      for (const comment of batch) {
        try {
          // Set last_checked to now
          comment.last_checked = new Date();
          
          const { error } = await this.supabase
            .from('reddit_comments')
            .update(comment)
            .eq('id', comment.id);
          
          if (error) {
            const pgError = error as PostgrestError;
            this.logSupabaseError(pgError, `updating comment ${comment.id}`);
            throw error;
          }
          
          updatedIds.push(comment.id);
        } catch (err: unknown) {
          let errorMessage = 'Unknown error';
          
          if (err instanceof PostgrestError) {
            errorMessage = `Database error: ${err.message} (${err.code})`;
            this.logSupabaseError(err, `updating comment ${comment.id}`);
          } else if (err instanceof Error) {
            errorMessage = err.message;
            this.logger.error(`Error updating comment ${comment.id}: ${errorMessage}`, err);
          } else if (typeof err === 'object' && err !== null) {
            try {
              errorMessage = JSON.stringify(err, null, 2);
            } catch {
              errorMessage = 'Error object could not be stringified';
            }
            this.logger.error(`Error updating comment ${comment.id}: ${errorMessage}`);
          }
          
          // Log problematic comment data
          this.logger.debug('Problematic comment data:', {
            id: comment.id,
            post_id: comment.post_id,
            content_length: comment.content?.length,
            fields: Object.keys(comment)
          });
          
          // Continue with other comments instead of throwing
          continue;
        }
      }
      
      this.logger.info(`Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(comments.length/batchSize)}`);
    }
    
    this.logger.info(`Updated ${updatedIds.length} comments successfully`);
    return updatedIds;
  }
  
  // Get all existing posts by ID
  async getExistingPosts(postIds: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Fetching ${postIds.length} existing posts in batches of ${batchSize}`);
    
    // Process in batches to avoid query size limits
    for (let i = 0; i < postIds.length; i += batchSize) {
      const batchIds = postIds.slice(i, i + batchSize);
      
      try {
        const { data, error } = await this.supabase
          .from('reddit_posts')
          .select('*')
          .in('id', batchIds);
        
        if (error) throw error;
        
        // Add to result map
        data.forEach((post: any) => {
          result.set(post.id, post);
        });
        
        this.logger.debug(`Fetched batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(postIds.length/batchSize)}`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorObj = err instanceof Error ? err : new Error(String(err));
        this.logger.error(`Error fetching posts batch: ${errorMessage}`, errorObj);
        // Continue with next batch
      }
    }
    
    this.logger.info(`Fetched ${result.size} existing posts`);
    return result;
  }
  
  // Get all existing comments by ID
  async getExistingComments(commentIds: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Fetching ${commentIds.length} existing comments in batches of ${batchSize}`);
    
    // Process in batches to avoid query size limits
    for (let i = 0; i < commentIds.length; i += batchSize) {
      const batchIds = commentIds.slice(i, i + batchSize);
      
      try {
        const { data, error } = await this.supabase
          .from('reddit_comments')
          .select('*')
          .in('id', batchIds);
        
        if (error) throw error;
        
        // Add to result map
        data.forEach((comment: any) => {
          result.set(comment.id, comment);
        });
        
        this.logger.debug(`Fetched batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(commentIds.length/batchSize)}`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorObj = err instanceof Error ? err : new Error(String(err));
        this.logger.error(`Error fetching comments batch: ${errorMessage}`, errorObj);
        // Continue with next batch
      }
    }
    
    this.logger.info(`Fetched ${result.size} existing comments`);
    return result;
  }
} 