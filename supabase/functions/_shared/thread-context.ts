/**
 * Thread Context Utilities
 * 
 * This module provides functions for extracting and utilizing thread context
 * for comment embeddings, making them more relevant in searches.
 */

/**
 * Thread context information for a comment
 */
export interface ThreadContext {
  postId: string;
  postTitle?: string;
  subreddit?: string;
  parentId?: string;
  path?: string[];
  depth?: number;
  parentComments?: string[];
}

/**
 * Enhanced thread context with additional metadata
 */
export interface EnhancedThreadContext extends ThreadContext {
  threadSummary?: string;
  mainTopics?: string[];
  conversationFlow?: {
    startTopic?: string;
    currentTopic?: string;
    topicShifts?: number;
  };
}

/**
 * Builds thread context for a comment
 * 
 * @param commentId - The ID of the comment to build context for
 * @param postInfo - Optional information about the parent post
 * @param parentComments - Optional array of parent comments in the thread
 * @returns Thread context object
 */
export function buildThreadContext(
  commentId: string,
  postInfo?: { 
    id: string; 
    title?: string; 
    subreddit?: string;
  },
  parentComments?: Array<{ 
    id: string; 
    content: string;
  }>
): ThreadContext {
  // Start with basic context
  const context: ThreadContext = {
    postId: postInfo?.id || '',
    postTitle: postInfo?.title,
    subreddit: postInfo?.subreddit,
  };
  
  // Add parent comments if available
  if (parentComments && parentComments.length > 0) {
    context.parentId = parentComments[parentComments.length - 1].id;
    context.path = parentComments.map(c => c.id);
    context.depth = parentComments.length;
    context.parentComments = parentComments.map(c => c.content);
  }
  
  return context;
}

/**
 * Creates an enhanced embedding input that incorporates thread context
 * 
 * @param commentText - The text content of the comment
 * @param threadContext - Thread context information
 * @param entityInfo - Optional entity extraction results
 * @returns Text string enhanced with thread context
 */
export function createThreadEnhancedInput(
  commentText: string,
  threadContext: ThreadContext,
  entityInfo?: {
    topics?: string[];
    locations?: string[];
    semanticTags?: string[];
  }
): string {
  // Build header with post information
  const postContext = threadContext.postTitle 
    ? `Post: ${threadContext.postTitle}\n` 
    : '';
  
  // Build subreddit context
  const subredditContext = threadContext.subreddit 
    ? `Subreddit: r/${threadContext.subreddit}\n` 
    : '';
  
  // Build parent comments context
  const parentContext = threadContext.parentComments && threadContext.parentComments.length > 0
    ? `Thread context:\n${threadContext.parentComments.map((c, i) => `[${i+1}] ${c}`).join('\n')}\n`
    : '';
  
  // Build entity context
  let entityContext = '';
  if (entityInfo) {
    if (entityInfo.topics && entityInfo.topics.length > 0) {
      entityContext += `Topics: ${entityInfo.topics.join(', ')}\n`;
    }
    if (entityInfo.locations && entityInfo.locations.length > 0) {
      entityContext += `Locations: ${entityInfo.locations.join(', ')}\n`;
    }
    if (entityInfo.semanticTags && entityInfo.semanticTags.length > 0) {
      entityContext += `Tags: ${entityInfo.semanticTags.join(', ')}\n`;
    }
  }
  
  // Combine all context with the comment text
  return `${postContext}${subredditContext}${parentContext}${entityContext}Comment: ${commentText}`;
}

/**
 * Extracts a summary of the thread context
 * 
 * @param threadContext - Thread context information
 * @returns A summary string of the context
 */
export function getThreadSummary(threadContext: ThreadContext): string {
  if (!threadContext.parentComments || threadContext.parentComments.length === 0) {
    return threadContext.postTitle 
      ? `Comment on post "${threadContext.postTitle}"` 
      : 'Direct comment on post';
  }
  
  const commentCount = threadContext.parentComments.length;
  const depthDescription = commentCount === 1 
    ? 'Reply to 1 comment' 
    : `Reply in a thread with ${commentCount} parent comments`;
  
  return threadContext.postTitle 
    ? `${depthDescription} on post "${threadContext.postTitle}"` 
    : depthDescription;
} 