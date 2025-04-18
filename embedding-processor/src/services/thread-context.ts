// src/services/thread-context.ts
import { OpenAI } from 'openai';
import { ThreadContext, Post, ParentComment, EntityTags } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Build thread context for a comment
 */
export function buildThreadContext(
  commentId: string,
  post: {
    id: string;
    title: string;
    subreddit: string;
    content?: string; // Include post content
  },
  parentComments: ParentComment[]
): ThreadContext {
  // Sort parent comments by ID to ensure correct order
  const sortedParents = [...parentComments].sort((a, b) => a.id.localeCompare(b.id));
  
  return {
    postId: post.id,
    postTitle: post.title,
    postContent: post.content, // Include post content in context
    subreddit: post.subreddit,
    path: sortedParents.map(p => p.id),
    depth: sortedParents.length,
    parent_comments: sortedParents,
    summary: '' // Will be populated later
  };
}

/**
 * Generate a thread summary using GPT-3.5 Turbo
 */
export async function generateThreadSummary(
  context: ThreadContext
): Promise<string> {
  try {
    if (!context.parent_comments || context.parent_comments.length === 0) {
      return '';
    }
    
    const commentTexts = context.parent_comments.map(c => c.content).join('\n\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Provide a brief summary of this Reddit conversation thread in 1-2 sentences.'
        },
        {
          role: 'user',
          content: `Subreddit: r/${context.subreddit}
Post Title: ${context.postTitle}
${context.postContent ? `Post Content: ${context.postContent.substring(0, 500)}${context.postContent.length > 500 ? '...' : ''}` : ''}

Thread Comments:
${commentTexts}

Summarize this thread concisely.`
        }
      ],
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating thread summary:', error);
    return '';
  }
}

/**
 * Get thread summary - returns existing or generates new
 * Only generates summaries for threads with depth > 3 (cost optimization)
 */
export async function getThreadSummary(context: ThreadContext): Promise<string> {
  if (context.summary) {
    return context.summary;
  }
  
  // Only generate summaries for deeper threads (cost optimization)
  if (context.parent_comments && context.parent_comments.length > 3) {
    console.log(`Generating summary for deep thread with depth ${context.depth}...`);
    return await generateThreadSummary(context);
  }
  
  // For shallow threads, don't generate a summary
  return '';
}

/**
 * Create enhanced input for thread context
 */
export function createThreadEnhancedInput(
  commentContent: string,
  threadContext: ThreadContext,
  entityTags: EntityTags
): string {
  // Create an enhanced representation that includes thread context
  let enhancedContent = `Subreddit: r/${threadContext.subreddit || 'unknown'}
Post Title: ${threadContext.postTitle || ''}`;

  // Add post content if available (truncated if very long)
  if (threadContext.postContent) {
    const truncatedPostContent = threadContext.postContent.length > 500 
      ? threadContext.postContent.substring(0, 500) + '...' 
      : threadContext.postContent;
    enhancedContent += `\nPost Content: ${truncatedPostContent}`;
  }

  // Add topics if available
  if (entityTags.topics && entityTags.topics.length > 0) {
    enhancedContent += `\nTopics: ${entityTags.topics.join(', ')}`;
  }
  
  // Add locations if available
  if (entityTags.locations && entityTags.locations.length > 0) {
    enhancedContent += `\nLocations: ${entityTags.locations.join(', ')}`;
  }
  
  // Add semantic tags if available
  if (entityTags.semanticTags && entityTags.semanticTags.length > 0) {
    enhancedContent += `\nTags: ${entityTags.semanticTags.join(', ')}`;
  }
  
  // Add thread depth
  enhancedContent += `\nThread Depth: ${threadContext.depth || 0}`;
  
  // Add thread summary if available
  if (threadContext.summary) {
    enhancedContent += `\nThread Summary: ${threadContext.summary}`;
  }
  
  // Add parent comments summaries if available
  if (threadContext.parent_comments && threadContext.parent_comments.length > 0) {
    enhancedContent += `\nParent Comments Summary:\n`;
    threadContext.parent_comments.forEach((comment, index) => {
      // Truncate long comments
      const truncatedContent = comment.content.length > 100 
        ? comment.content.substring(0, 100) + '...' 
        : comment.content;
      enhancedContent += `${index + 1}. ${truncatedContent}\n`;
    });
  }
  
  // Add the actual comment content
  enhancedContent += `\nComment Content: ${commentContent}`;
  
  return enhancedContent;
} 