import { SearchResult } from '@/app/lib/supabase/types';
import { CommentSearchResult } from '@/app/lib/search/query-processor';

/**
 * Format search results for LLM consumption.
 * 
 * This prepares the search results in a format that's suitable for the LLM's context,
 * with appropriate structure and truncation to fit within token limits.
 * 
 * @param results Search results from the database
 * @param query The original user query
 * @returns Formatted string for LLM input
 */
export function formatSearchResultsForLLM(
  results: SearchResult[] | CommentSearchResult[],
  query: string
): string {
  return `
Query: "${query}"

Search Results:
${results.map((result, index) => `
[Result ${index + 1}]
Title: ${result.title}
Content: ${result.content}
URL: ${result.url || 'N/A'}
Subreddit: ${result.subreddit || 'N/A'}
Author: ${result.author || 'N/A'}
Created: ${formatDate(result.created_at)}
Similarity: ${result.similarity ? Math.round(result.similarity * 100) / 100 : 'N/A'}
${result.metadata ? `Topics: ${JSON.stringify(result.metadata.topics || [])}` : ''}
${result.metadata ? `Locations: ${JSON.stringify(result.metadata.locations || [])}` : ''}
${result.metadata?.thread_context?.postTitle ? `Original Post Title: ${result.metadata.thread_context.postTitle}` : ''}
`).join('\n')}

Based on these search results, provide a comprehensive answer to the query: "${query}"
Use citations like [1], [2], etc. to reference specific results.
`;
}

/**
 * Format search result for client consumption.
 * 
 * This prepares a single search result for displaying in the frontend,
 * including adding the index for citation referencing.
 * 
 * @param result Single search result from the database
 * @param index The index of this result (for citations)
 * @returns Client-formatted result object
 */
export function formatResultForClient(
  result: SearchResult | CommentSearchResult, 
  index: number
) {
  return {
    id: result.id,
    title: result.title,
    snippet: result.content_snippet || truncateContent(result.content, 200),
    url: result.url,
    subreddit: result.subreddit,
    author: result.author,
    created_at: result.created_at,
    index: index + 1, // For citation referencing (1-based indexing)
    // Include post context for comments
    postTitle: result.metadata?.thread_context?.postTitle || null,
    contentType: result.content_type || 'post'
  };
}

/**
 * Format multiple results for client consumption.
 * 
 * @param results Array of search results from the database
 * @returns Array of client-formatted results
 */
export function formatResultsForClient(
  results: SearchResult[] | CommentSearchResult[]
) {
  return results.map((result, index) => formatResultForClient(result, index));
}

/**
 * Estimate token count for a string (very rough estimation).
 * 
 * This uses a simple heuristic of ~4 characters per token, which is
 * a rough approximation for English text with GPT/Claude tokenizers.
 * 
 * @param text The text to estimate tokens for
 * @returns Estimated number of tokens
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate content to a maximum length.
 * 
 * @param content The content to truncate
 * @param maxLength Maximum length in characters
 * @returns Truncated content with ellipsis if needed
 */
function truncateContent(content: string, maxLength: number): string {
  if (!content) return '';
  return content.length > maxLength
    ? content.substring(0, maxLength) + '...'
    : content;
}

/**
 * Format a date as a readable string.
 * 
 * @param date Date string or object
 * @returns Formatted date string
 */
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown date';
  const d = new Date(date);
  return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString();
} 