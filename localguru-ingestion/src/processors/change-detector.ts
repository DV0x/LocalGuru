import { createHash } from 'crypto';
import { Logger } from '../utils/logger';

interface ChangeDetectorConfig {
  checksumFields: string[];
  ignoreFields: string[];
  forceUpdateAfterDays: number;
}

export class ChangeDetector {
  private config: ChangeDetectorConfig;
  private logger: Logger;
  
  constructor(config: ChangeDetectorConfig) {
    this.config = {
      checksumFields: config.checksumFields || ['title', 'content', 'score'],
      ignoreFields: config.ignoreFields || ['last_updated'],
      forceUpdateAfterDays: config.forceUpdateAfterDays || 7
    };
    
    this.logger = new Logger('ChangeDetector');
  }
  
  // Generate checksum for content
  generateChecksum(content: any): string {
    const fields = this.config.checksumFields;
    let checksumInput = '';
    
    for (const field of fields) {
      if (content[field] !== undefined) {
        checksumInput += String(content[field]);
      }
    }
    
    return createHash('md5').update(checksumInput).digest('hex');
  }
  
  // Check if content needs updating based on age
  private needsForcedUpdate(lastChecked: Date | string | null | undefined): boolean {
    if (!lastChecked) return true;
    
    const now = new Date();
    // Ensure lastChecked is a Date object
    const lastCheckedDate = lastChecked instanceof Date 
      ? lastChecked 
      : new Date(lastChecked);
    
    // Check if valid date before proceeding
    if (isNaN(lastCheckedDate.getTime())) {
      this.logger.warn(`Invalid date detected: ${lastChecked}, forcing update`);
      return true;
    }
    
    const diffDays = (now.getTime() - lastCheckedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return diffDays >= this.config.forceUpdateAfterDays;
  }
  
  // Detect changes in posts
  async detectPostChanges(
    posts: any[],
    existingPosts: Map<string, any>
  ): Promise<{
    new: any[],
    updated: any[],
    unchanged: any[]
  }> {
    const newPosts: any[] = [];
    const updatedPosts: any[] = [];
    const unchangedPosts: any[] = [];
    
    for (const post of posts) {
      const postId = post.id;
      const newChecksum = this.generateChecksum(post);
      
      // Set the checksum on the post object
      post.content_checksum = newChecksum;
      
      const existingPost = existingPosts.get(postId);
      
      if (!existingPost) {
        // New post
        this.logger.debug(`New post detected: ${postId}`);
        newPosts.push(post);
      } else {
        // Check if the post has changed
        const existingChecksum = existingPost.content_checksum;
        
        // Set last_checked timestamp for current time if not present
        post.last_checked = new Date();
        
        const needsForceUpdate = this.needsForcedUpdate(existingPost.last_checked);
        
        if (newChecksum !== existingChecksum || needsForceUpdate) {
          // Post has changed or needs a forced update
          this.logger.debug(`Updated post detected: ${postId}`);
          
          // Copy fields that should persist
          for (const field of this.config.ignoreFields) {
            if (existingPost[field] !== undefined && post[field] === undefined) {
              post[field] = existingPost[field];
            }
          }
          
          // Increment update count
          post.update_count = (existingPost.update_count || 0) + 1;
          
          updatedPosts.push(post);
        } else {
          // Post hasn't changed
          this.logger.debug(`Unchanged post: ${postId}`);
          unchangedPosts.push(post);
        }
      }
    }
    
    this.logger.info(`Change detection complete: ${newPosts.length} new, ${updatedPosts.length} updated, ${unchangedPosts.length} unchanged`);
    
    return {
      new: newPosts,
      updated: updatedPosts,
      unchanged: unchangedPosts
    };
  }
  
  // Detect changes in comments (similar to posts)
  async detectCommentChanges(
    comments: any[],
    existingComments: Map<string, any>
  ): Promise<{
    new: any[],
    updated: any[],
    unchanged: any[]
  }> {
    const newComments: any[] = [];
    const updatedComments: any[] = [];
    const unchangedComments: any[] = [];
    
    for (const comment of comments) {
      const commentId = comment.id;
      const newChecksum = this.generateChecksum(comment);
      
      // Set the checksum on the comment object
      comment.content_checksum = newChecksum;
      
      const existingComment = existingComments.get(commentId);
      
      if (!existingComment) {
        // New comment
        this.logger.debug(`New comment detected: ${commentId}`);
        newComments.push(comment);
      } else {
        // Check if the comment has changed
        const existingChecksum = existingComment.content_checksum;
        
        // Set last_checked timestamp for current time if not present
        comment.last_checked = new Date();
        
        const needsForceUpdate = this.needsForcedUpdate(existingComment.last_checked);
        
        if (newChecksum !== existingChecksum || needsForceUpdate) {
          // Comment has changed or needs a forced update
          this.logger.debug(`Updated comment detected: ${commentId}`);
          
          // Copy fields that should persist
          for (const field of this.config.ignoreFields) {
            if (existingComment[field] !== undefined && comment[field] === undefined) {
              comment[field] = existingComment[field];
            }
          }
          
          // Increment update count
          comment.update_count = (existingComment.update_count || 0) + 1;
          
          updatedComments.push(comment);
        } else {
          // Comment hasn't changed
          this.logger.debug(`Unchanged comment: ${commentId}`);
          unchangedComments.push(comment);
        }
      }
    }
    
    this.logger.info(`Comment change detection complete: ${newComments.length} new, ${updatedComments.length} updated, ${unchangedComments.length} unchanged`);
    
    return {
      new: newComments,
      updated: updatedComments,
      unchanged: unchangedComments
    };
  }
} 