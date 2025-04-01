import { RedditAPI } from './reddit-api';
import { Logger } from '../utils/logger';
import { delay } from '../utils/helpers';
import fs from 'fs';
import path from 'path';
import { ChangeDetector } from '../processors';
import { DBHandler } from '../db/db-handler';
import { createHash } from 'crypto';

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string;
  url: string;
  permalink: string;
  author_id: string;
  created_at: Date;
  score: number;
  upvote_ratio: number;
  is_nsfw: boolean;
  is_spoiler: boolean;
  flair: string;
  is_self_post: boolean;
  original_json: any;
  extracted_topics: string[];
  extracted_locations: string[];
  semantic_tags: string[];
  content_checksum: string | null;
  last_checked: Date;
  update_count: number;
  is_removed: boolean;
  extracted_entities?: any;
  search_vector?: any;
  last_updated?: Date;
}

export interface RedditComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  author_id: string;
  created_at: Date;
  score: number;
  path: string[];
  depth: number;
  original_json: any;
  content_checksum: string | null;
  last_checked: Date;
  update_count: number;
  is_removed: boolean;
  is_stickied: boolean;
  thread_context: string;
  extracted_entities: any;
  extracted_topics: string[];
  search_vector: any;
  embedding?: any;
}

// Processor interface for streaming data handling
export interface BatchProcessor {
  processBatch(posts: RedditPost[], comments: RedditComment[]): Promise<void>;
}

// Default batch processor that uses DB handler and change detector
export class DefaultBatchProcessor implements BatchProcessor {
  private dbHandler: DBHandler;
  private changeDetector: ChangeDetector;
  private logger: Logger;
  private subreddit: string;
  
  constructor(dbHandler: DBHandler, changeDetector: ChangeDetector, subreddit: string) {
    this.dbHandler = dbHandler;
    this.changeDetector = changeDetector;
    this.logger = new Logger('BatchProcessor');
    this.subreddit = subreddit;
  }
  
  async processBatch(posts: RedditPost[], comments: RedditComment[]): Promise<void> {
    if (!posts.length) return;
    
    this.logger.info(`Processing batch of ${posts.length} posts and ${comments.length} comments from r/${this.subreddit}`);
    
    try {
      // Get post and comment IDs
      const postIds = posts.map(post => post.id);
      const commentIds = comments.map(comment => comment.id);
      
      // Get existing content for change detection
      const existingPosts = await this.dbHandler.getExistingPosts(postIds);
      const existingComments = await this.dbHandler.getExistingComments(commentIds);
      
      // Detect changes
      const postChanges = await this.changeDetector.detectPostChanges(posts, existingPosts);
      const commentChanges = await this.changeDetector.detectCommentChanges(comments, existingComments);
      
      // Skip if no changes
      if (!postChanges.new.length && !postChanges.updated.length && 
          !commentChanges.new.length && !commentChanges.updated.length) {
        this.logger.info('No changes detected in this batch');
        return;
      }
      
      // Perform database operations
      await this.dbHandler.disableTriggers();
      
      if (postChanges.new.length) {
        await this.dbHandler.insertPosts(postChanges.new);
      }
      
      if (postChanges.updated.length) {
        await this.dbHandler.updatePosts(postChanges.updated);
      }
      
      if (commentChanges.new.length) {
        await this.dbHandler.insertComments(commentChanges.new);
      }
      
      if (commentChanges.updated.length) {
        await this.dbHandler.updateComments(commentChanges.updated);
      }
      
      await this.dbHandler.enableTriggers();
      
      this.logger.info(`Processed batch: ${postChanges.new.length} new posts, ${postChanges.updated.length} updated posts, ` +
                      `${commentChanges.new.length} new comments, ${commentChanges.updated.length} updated comments`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error processing batch: ${err.message}`);
      throw err; // Re-throw to allow retry logic in caller
    }
  }
}

// Checkpoint interface to track progress
export interface FetchCheckpoint {
  subreddit: string;
  completedPostIds: string[];
  lastAfter: string | undefined | null;
  fetchedCount: number;
  maxPosts: number;
  sort: 'new' | 'hot' | 'top';
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  timestamp: string;
}

export class RedditFetcher {
  private api: RedditAPI;
  private logger: Logger;
  private checkpointDir: string;
  
  constructor(config: {
    userAgent: string;
    requestDelay?: number;
    checkpointDir?: string;
  }) {
    this.api = new RedditAPI({
      userAgent: config.userAgent,
      requestDelay: config.requestDelay
    });
    this.logger = new Logger('RedditFetcher');
    this.checkpointDir = config.checkpointDir || path.join(process.cwd(), 'checkpoints');
    
    // Ensure checkpoint directory exists
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }
  
  // Save checkpoint to file
  private saveCheckpoint(checkpoint: FetchCheckpoint): void {
    try {
      const filename = `${checkpoint.subreddit}-${checkpoint.sort}-${Date.now()}.json`;
      const filepath = path.join(this.checkpointDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
      this.logger.info(`Saved checkpoint to ${filepath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to save checkpoint: ${err.message}`);
    }
  }
  
  // Find latest checkpoint for a subreddit
  private findLatestCheckpoint(subreddit: string, sort: 'new' | 'hot' | 'top'): FetchCheckpoint | null {
    try {
      if (!fs.existsSync(this.checkpointDir)) return null;
      
      const files = fs.readdirSync(this.checkpointDir)
        .filter(file => file.startsWith(`${subreddit}-${sort}`) && file.endsWith('.json'))
        .sort((a, b) => {
          const timestampA = parseInt(a.split('-').pop()?.replace('.json', '') || '0');
          const timestampB = parseInt(b.split('-').pop()?.replace('.json', '') || '0');
          return timestampB - timestampA; // Sort descending (newest first)
        });
      
      if (files.length === 0) return null;
      
      const latestFile = files[0];
      const filepath = path.join(this.checkpointDir, latestFile);
      const content = fs.readFileSync(filepath, 'utf-8');
      const checkpoint = JSON.parse(content) as FetchCheckpoint;
      
      this.logger.info(`Found checkpoint for ${subreddit} (${checkpoint.fetchedCount}/${checkpoint.maxPosts} posts)`);
      return checkpoint;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to find checkpoint: ${err.message}`);
      return null;
    }
  }
  
  // Add helper function for generating checksums
  private generateChecksum(content: any, fields: string[] = ['title', 'content', 'score']): string {
    let checksumInput = '';
    
    for (const field of fields) {
      if (content[field] !== undefined) {
        checksumInput += String(content[field]);
      }
    }
    
    return createHash('md5').update(checksumInput).digest('hex');
  }
  
  // Transform Reddit API post to our format
  private transformPost(rawPost: any): RedditPost {
    const post = rawPost.data;
    
    const transformed: RedditPost = {
      id: post.id,
      subreddit: post.subreddit,
      title: post.title || '[No Title]',
      content: post.selftext || '',
      url: post.url || '',
      permalink: post.permalink || '',
      author_id: post.author || '[deleted]',
      created_at: new Date(post.created_utc * 1000),
      score: post.score || 0,
      upvote_ratio: post.upvote_ratio || 1.0,
      is_nsfw: Boolean(post.over_18),
      is_spoiler: Boolean(post.spoiler),
      flair: post.link_flair_text || '',
      is_self_post: Boolean(post.is_self),
      original_json: post,
      extracted_topics: [],
      extracted_locations: [],
      semantic_tags: [],
      content_checksum: '', // Will be set below
      last_checked: new Date(),
      update_count: 0,
      is_removed: false,
      extracted_entities: {},
      search_vector: null,
      last_updated: new Date()
    };
    
    // Generate checksum from title, content, and score
    transformed.content_checksum = this.generateChecksum(transformed);
    
    return transformed;
  }
  
  // Process comments recursively
  private processComments(
    comments: any[],
    postId: string,
    parentId: string | null = null,
    depth: number = 0,
    path: string[] = []
  ): RedditComment[] {
    let allComments: RedditComment[] = [];
    
    for (const comment of comments) {
      // Skip non-comment items like "more" links
      if (comment.kind !== 't1') continue;
      
      const data = comment.data;
      
      // Skip deleted/removed comments
      if (data.body === '[deleted]' || data.body === '[removed]') continue;
      
      const commentId = data.id;
      const newPath = [...path, commentId];
      
      // Create comment object
      const transformed: RedditComment = {
        id: commentId,
        post_id: postId,
        parent_id: parentId,
        content: data.body || '[No Content]',
        author_id: data.author || '[deleted]',
        created_at: new Date(data.created_utc * 1000),
        score: data.score || 0,
        path: newPath || [],
        depth: depth || 0,
        original_json: data,
        content_checksum: '', // Will be set below
        last_checked: new Date(),
        update_count: 0,
        is_removed: false,
        is_stickied: Boolean(data.stickied),
        thread_context: '',
        extracted_entities: {},
        extracted_topics: [],
        search_vector: null,
        embedding: null
      };
      
      // Generate checksum from content and score
      transformed.content_checksum = this.generateChecksum(transformed, ['content', 'score']);
      
      // Add to results
      allComments.push(transformed);
      
      // Process replies recursively
      if (data.replies && data.replies.data && data.replies.data.children) {
        const childComments = this.processComments(
          data.replies.data.children,
          postId,
          commentId,
          depth + 1,
          newPath
        );
        
        allComments = [...allComments, ...childComments];
      }
    }
    
    return allComments;
  }
  
  // Fetch a single post with its comments
  async fetchPost(postId: string): Promise<{
    post: RedditPost;
    comments: RedditComment[];
  }> {
    this.logger.info(`Fetching post ${postId}`);
    
    const response = await this.api.getPostComments(postId);
    
    // Response is an array: [post, comments]
    const postData = response[0].data.children[0];
    const commentsData = response[1].data.children;
    
    const post = this.transformPost(postData);
    const comments = this.processComments(commentsData, postId);
    
    this.logger.info(`Fetched post ${postId} with ${comments.length} comments`);
    
    return { post, comments };
  }
  
  // New streaming version of fetchSubreddit
  async streamSubreddit(
    subreddit: string, 
    processor: BatchProcessor, 
    options: {
      maxPosts?: number;
      fetchAllTime?: boolean;
      sort?: 'new' | 'hot' | 'top';
      useCheckpoints?: boolean;
      batchSize?: number;
      maxAgeHours?: number;
      minAgeHours?: number;
    } = {}
  ): Promise<{
    totalPosts: number;
    totalComments: number;
    completedPostIds: string[];
  }> {
    const maxPosts = options.maxPosts || 100;
    const sort = options.sort || 'new';
    const time = options.fetchAllTime ? 'all' : 'month';
    const useCheckpoints = options.useCheckpoints !== false; // Default to true
    const batchProcessSize = options.batchSize || 25; // Process 25 posts at a time
    const maxAgeHours = options.maxAgeHours;
    const minAgeHours = options.minAgeHours;
    
    this.logger.info(`Streaming up to ${maxPosts} posts from r/${subreddit}`);
    if (maxAgeHours) {
      this.logger.info(`Filtering posts newer than ${maxAgeHours} hours`);
    }
    if (minAgeHours) {
      this.logger.info(`Filtering posts older than ${minAgeHours} hours`);
    }
    
    // Stats tracking
    let totalProcessedPosts = 0;
    let totalProcessedComments = 0;
    const completedPostIds: string[] = [];
    
    // Try to find and load checkpoint if enabled
    let checkpoint: FetchCheckpoint | null = null;
    if (useCheckpoints) {
      checkpoint = this.findLatestCheckpoint(subreddit, sort);
    }
    
    // Start after the last post we fetched if resuming from checkpoint
    let after = checkpoint?.lastAfter || null;
    let fetchedCount = checkpoint?.fetchedCount || 0;
    
    // If we have a checkpoint, skip posts we've already processed
    if (checkpoint) {
      completedPostIds.push(...checkpoint.completedPostIds);
    }
    
    const apiCallBatchSize = 25; // Reddit API typically returns up to 25 posts per request
    const checkpointFrequency = 5; // Create checkpoint every 5 API calls
    
    try {
      let currentBatchPosts: RedditPost[] = [];
      let currentBatchComments: RedditComment[] = [];
      
      while (fetchedCount < maxPosts) {
        // Get a batch of posts
        const response = await this.api.getSubredditPosts(subreddit, {
          limit: apiCallBatchSize,
          after: after || undefined,
          sort,
          time
        });
        
        if (!response.data.children.length) {
          this.logger.info("No more posts to fetch");
          break;
        }
        
        // Process posts one by one
        for (const child of response.data.children) {
          const rawPost = child.data;
          const postId = rawPost.id;
          
          // Skip if we've already processed this post (from checkpoint)
          if (completedPostIds.includes(postId)) {
            this.logger.debug(`Skipping already processed post ${postId}`);
            continue;
          }
          
          // Skip if post is outside our age range
          if (maxAgeHours || minAgeHours) {
            const createdUtc = rawPost.created_utc * 1000; // Convert to milliseconds
            const postAgeHours = (Date.now() - createdUtc) / (1000 * 60 * 60);
            
            if (maxAgeHours && postAgeHours > maxAgeHours) {
              this.logger.debug(`Skipping post ${postId} as it's older than ${maxAgeHours} hours (${Math.floor(postAgeHours)} hours old)`);
              continue;
            }
            
            if (minAgeHours && postAgeHours < minAgeHours) {
              this.logger.debug(`Skipping post ${postId} as it's newer than ${minAgeHours} hours (${Math.floor(postAgeHours)} hours old)`);
              continue;
            }
          }
          
          try {
            this.logger.info(`Fetching post ${postId}`);
            const result = await this.fetchPost(postId);
            
            // Add to current batch
            currentBatchPosts.push(result.post);
            currentBatchComments.push(...result.comments);
            
            fetchedCount++;
            completedPostIds.push(postId);
            
            this.logger.info(`Fetched post ${postId} with ${result.comments.length} comments`);
            
            // Process batch if it reaches the batch size
            if (currentBatchPosts.length >= batchProcessSize) {
              await this.processBatchWithRetry(processor, currentBatchPosts, currentBatchComments);
              
              // Update stats
              totalProcessedPosts += currentBatchPosts.length;
              totalProcessedComments += currentBatchComments.length;
              
              // Clear current batch
              currentBatchPosts = [];
              currentBatchComments = [];
              
              // Save checkpoint
              if (useCheckpoints) {
                const newCheckpoint: FetchCheckpoint = {
                  subreddit,
                  completedPostIds,
                  lastAfter: after,
                  fetchedCount,
                  maxPosts,
                  sort,
                  time,
                  timestamp: new Date().toISOString()
                };
                this.saveCheckpoint(newCheckpoint);
              }
            }
            
            if (fetchedCount >= maxPosts) {
              break;
            }
            
            // Respect rate limits between post fetches
            await delay(2000);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Error fetching post ${postId}: ${err.message}`);
            
            // Continue with next post on error
            await delay(5000); // Add extra delay after an error
          }
        }
        
        // Process any remaining posts in batch before moving to next page
        if (currentBatchPosts.length > 0) {
          await this.processBatchWithRetry(processor, currentBatchPosts, currentBatchComments);
          
          // Update stats
          totalProcessedPosts += currentBatchPosts.length;
          totalProcessedComments += currentBatchComments.length;
          
          // Clear current batch
          currentBatchPosts = [];
          currentBatchComments = [];
        }
        
        // Update the 'after' parameter for the next page
        after = response.data.after;
        
        // Break if we've reached the end of the subreddit
        if (!after) {
          this.logger.info("Reached end of subreddit");
          break;
        }
        
        // Create checkpoint at the end of each page
        if (useCheckpoints) {
          const newCheckpoint: FetchCheckpoint = {
            subreddit,
            completedPostIds,
            lastAfter: after,
            fetchedCount,
            maxPosts,
            sort,
            time,
            timestamp: new Date().toISOString()
          };
          this.saveCheckpoint(newCheckpoint);
        }
        
        // Add a delay between page fetches
        await delay(2000);
      }
      
      // Final checkpoint when done
      if (useCheckpoints) {
        const finalCheckpoint: FetchCheckpoint = {
          subreddit,
          completedPostIds,
          lastAfter: after,
          fetchedCount,
          maxPosts,
          sort,
          time,
          timestamp: new Date().toISOString()
        };
        this.saveCheckpoint(finalCheckpoint);
      }
      
      this.logger.info(`Completed streaming from r/${subreddit}: ${totalProcessedPosts} posts, ${totalProcessedComments} comments`);
      
      return { 
        totalPosts: totalProcessedPosts, 
        totalComments: totalProcessedComments,
        completedPostIds
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to stream subreddit ${subreddit}: ${err.message}`);
      
      // Create error checkpoint
      if (useCheckpoints) {
        const errorCheckpoint: FetchCheckpoint = {
          subreddit,
          completedPostIds,
          lastAfter: after,
          fetchedCount,
          maxPosts,
          sort,
          time,
          timestamp: new Date().toISOString()
        };
        this.saveCheckpoint(errorCheckpoint);
      }
      
      // Return stats of what we processed so far
      return { 
        totalPosts: totalProcessedPosts, 
        totalComments: totalProcessedComments,
        completedPostIds
      };
    }
  }
  
  // Process a batch with retry logic
  private async processBatchWithRetry(
    processor: BatchProcessor,
    posts: RedditPost[],
    comments: RedditComment[],
    maxRetries: number = 3
  ): Promise<void> {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        this.logger.info(`Processing batch of ${posts.length} posts and ${comments.length} comments (attempt ${attempts + 1}/${maxRetries})`);
        await processor.processBatch(posts, comments);
        return; // Success, exit
      } catch (error) {
        attempts++;
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Error processing batch (attempt ${attempts}/${maxRetries}): ${err.message}`);
        
        if (attempts >= maxRetries) {
          this.logger.error(`Failed to process batch after ${maxRetries} attempts`);
          throw error;
        }
        
        // Exponential backoff
        const backoffDelay = Math.min(Math.pow(2, attempts) * 1000, 30000);
        this.logger.info(`Retrying batch in ${Math.round(backoffDelay / 1000)} seconds...`);
        await delay(backoffDelay);
      }
    }
  }
  
  // Keep the original fetchSubreddit method for backward compatibility
  // but implement it using the new streaming approach
  async fetchSubreddit(subreddit: string, options: {
    maxPosts?: number;
    fetchAllTime?: boolean;
    sort?: 'new' | 'hot' | 'top';
    useCheckpoints?: boolean;
  } = {}): Promise<{
    posts: RedditPost[];
    comments: RedditComment[];
  }> {
    // Create a memory collector processor
    const posts: RedditPost[] = [];
    const comments: RedditComment[] = [];
    
    const memoryProcessor: BatchProcessor = {
      processBatch: async (batchPosts: RedditPost[], batchComments: RedditComment[]) => {
        posts.push(...batchPosts);
        comments.push(...batchComments);
      }
    };
    
    // Use the streaming approach
    await this.streamSubreddit(subreddit, memoryProcessor, {
      ...options,
      batchSize: 100 // Use a larger batch size for memory collection since we're not inserting to DB
    });
    
    return { posts, comments };
  }
  
  // Fetch historical data from a subreddit
  async fetchSubredditHistory(subreddit: string, options: {
    startDate?: Date;
    endDate?: Date;
    maxPosts?: number;
  } = {}): Promise<{
    posts: RedditPost[];
    comments: RedditComment[];
  }> {
    this.logger.info(`Fetching historical content from r/${subreddit}`);
    
    const startDate = options.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default to 1 year ago
    const endDate = options.endDate || new Date();
    
    let allPosts: RedditPost[] = [];
    let allComments: RedditComment[] = [];
    
    // Loop through each month in the range to work around Reddit API limitations
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthEnd = new Date(currentDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      // Don't go past the end date
      if (monthEnd > endDate) {
        monthEnd.setTime(endDate.getTime());
      }
      
      this.logger.info(`Fetching posts from ${currentDate.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`);
      
      // First try getting 'top' posts for this month period
      try {
        let monthPosts: RedditPost[] = [];
        const rawTopPosts = await this.api.getAllSubredditPosts(subreddit, {
          maxPosts: 250, // More posts for historical periods
          sort: 'top',
          time: 'month'
        });
        
        for (const rawPost of rawTopPosts) {
          const post = this.transformPost(rawPost);
          const postDate = new Date(post.created_at);
          
          // Filter by date range
          if (postDate >= currentDate && postDate <= monthEnd) {
            monthPosts.push(post);
          }
        }
        
        // Then get 'new' posts for the same period to ensure we get them all
        const rawNewPosts = await this.api.getAllSubredditPosts(subreddit, {
          maxPosts: 250,
          sort: 'new',
          time: 'month'
        });
        
        for (const rawPost of rawNewPosts) {
          const post = this.transformPost(rawPost);
          const postDate = new Date(post.created_at);
          
          // Filter by date range
          if (postDate >= currentDate && postDate <= monthEnd) {
            // Check if we already have this post to avoid duplicates
            if (!monthPosts.some(p => p.id === post.id)) {
              monthPosts.push(post);
            }
          }
        }
        
        this.logger.info(`Found ${monthPosts.length} posts for this month`);
        
        // Process each post and fetch its comments
        for (const post of monthPosts) {
          allPosts.push(post);
          
          try {
            // Fetch comments for this post
            const { comments } = await this.fetchPost(post.id);
            allComments = [...allComments, ...comments];
            
            this.logger.info(`Processed post ${post.id} with ${comments.length} comments`);
            
            // Rate limiting between posts
            await delay(2000);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Error fetching comments for post ${post.id}: ${err.message}`, err);
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Error fetching posts for month ${currentDate.toISOString().split('T')[0]}: ${err.message}`, err);
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
      
      // Add a longer delay between months to respect rate limits
      await delay(5000);
    }
    
    this.logger.info(`Completed historical fetch from r/${subreddit}: ${allPosts.length} posts, ${allComments.length} comments`);
    
    return {
      posts: allPosts,
      comments: allComments
    };
  }
} 