import { SearchResult } from '../supabase/types';
import { FormattedSearchResult } from './types';

/**
 * Formats search results from the database structure to a frontend-friendly format
 * @param results Search results from the database
 * @returns Formatted results ready for display
 */
export function formatSearchResults(results: SearchResult[]): FormattedSearchResult[] {
  return results.map((result) => ({
    id: result.id,
    title: formatTitle(result.title, result.subreddit),
    location: formatLocation(result.subreddit, result.metadata?.locations),
    description: formatDescription(result.content_snippet, result.metadata),
    tags: formatTags(result.metadata?.topics, result.match_type),
    source: formatSource(result.subreddit, result.author),
    sourceUrl: formatSourceUrl(result.url, result.id, result.permalink),
    similarity: result.similarity,
    matchType: result.match_type,
    // Pass the raw metadata for inspection
    metadata: result.metadata
  }));
}

/**
 * Formats the title, potentially adding context about the subreddit if needed
 */
function formatTitle(title: string, subreddit?: string): string {
  // Clean up the title by removing excessive spacing, line breaks, etc.
  let cleanedTitle = title.trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .replace(/\n+/g, ' '); // Replace line breaks with spaces

  // If title is empty, generate a placeholder based on subreddit
  if (!cleanedTitle && subreddit) {
    return `Post from r/${subreddit}`;
  }

  return cleanedTitle;
}

/**
 * Formats the location based on subreddit and metadata
 */
function formatLocation(subreddit?: string, locations?: string[]): string {
  // First try to use explicit locations from metadata
  if (locations && locations.length > 0) {
    return locations[0]; // Use first location
  }

  // Fall back to subreddit if it looks like a location
  if (subreddit) {
    // Remove 'r/' prefix if present
    const cleanSubreddit = subreddit.replace(/^r\//, '');
    
    // Return the subreddit as location if it doesn't contain typical non-location patterns
    if (!cleanSubreddit.match(/^(ask|true|best|top|help|advice|all|popular)/i)) {
      return cleanSubreddit;
    }
  }

  // Default fallback
  return 'Unknown location';
}

/**
 * Formats the description from the content snippet and includes thread context if available
 */
function formatDescription(contentSnippet?: string, metadata?: any): string {
  if (!contentSnippet) {
    return '';
  }

  // Clean up the content by removing excessive spacing, escaped characters, etc.
  const cleanedContent = contentSnippet
    .trim()
    .replace(/\\n/g, '\n') // Replace literal \n with actual line breaks
    .replace(/\n{3,}/g, '\n\n') // Replace excessive line breaks with double line breaks
    .replace(/\s{3,}/g, ' '); // Replace excessive spacing

  // Format paragraphs better by ensuring proper spacing
  let formattedContent = cleanedContent
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');

  // Add thread context if this is a comment and context is available
  if (metadata?.thread_context && metadata?.thread_context?.parentComments?.length > 0) {
    const threadContext = metadata.thread_context;
    
    // Check for self-reference - when a comment is its own parent
    const isSelfReference = threadContext.parentId === metadata.id;
    
    // Check for duplicate content - when parent comment text matches the content snippet
    const hasDuplicateContent = threadContext.parentComments.some((comment: string) => 
      comment.trim() === contentSnippet.trim());
      
    // Only show parent comments if they're not duplicates or self-references
    if (!isSelfReference && !hasDuplicateContent) {
      const formattedParentComments = threadContext.parentComments
        .map((comment: string, index: number) => {
          // Format each parent comment with indentation based on depth
          return `> ${comment.trim().replace(/\n/g, '\n> ')}`;
        })
        .join('\n\n');
      
      if (formattedParentComments) {
        // Add the parent post title if available
        const postTitle = threadContext.postTitle 
          ? `**Original Post: "${threadContext.postTitle}"**\n\n` 
          : '';
        
        // Add label for parent comment(s)
        const contextLabel = threadContext.parentComments.length > 1 
          ? '**Parent Comments:**\n\n' 
          : '**Parent Comment:**\n\n';
        
        // Combine everything
        return `${postTitle}${contextLabel}${formattedParentComments}\n\n**Response:**\n\n${formattedContent}`;
      }
    }
  }

  return formattedContent;
}

/**
 * Creates tags from topics and match type
 */
function formatTags(topics?: string[], matchType?: string): string[] {
  const tags: string[] = [];

  // Add topics as tags
  if (topics && topics.length > 0) {
    tags.push(...topics.slice(0, 5)); // Limit to 5 topic tags to avoid cluttering
  }

  // Add match type as a tag if it's interesting
  if (matchType && !matchType.includes('basic')) {
    tags.push(matchType.replace(/_/g, ' '));
  }

  return tags;
}

/**
 * Formats the source information
 */
function formatSource(subreddit?: string, author?: string): string {
  if (subreddit && author) {
    return `r/${subreddit} · u/${author}`;
  } else if (subreddit) {
    return `r/${subreddit}`;
  } else if (author) {
    return `u/${author}`;
  }
  return 'Unknown source';
}

/**
 * Formats the source URL for linking to original content
 */
function formatSourceUrl(url?: string, id?: string, permalink?: string): string {
  if (url && url.startsWith('http')) {
    return url;
  }
  
  if (permalink) {
    return `https://reddit.com${permalink}`;
  }
  
  if (id && id.startsWith('t3_')) {
    // It's a post
    const postId = id.replace('t3_', '');
    return `https://reddit.com/comments/${postId}`;
  } else if (id && id.startsWith('t1_')) {
    // It's a comment, but we don't have enough info to link directly
    return `https://reddit.com`;
  }
  
  return `https://reddit.com`;
} 