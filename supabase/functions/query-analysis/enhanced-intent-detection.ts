// Enhanced intent detection for social connection queries
// This module enhances the query analysis to better detect social connection queries
// and classify them as "how_to" intent for more relevant search results.

// Define the QueryIntent type directly to avoid circular imports
export type QueryIntent = 'recommendation' | 'information' | 'comparison' | 'experience' | 'local_events' | 'how_to' | 'discovery' | 'general';

// Define the patterns that indicate a social connection query
const SOCIAL_CONNECTION_PATTERNS = [
  'meet people', 'meeting people',
  'connect with people', 'connecting with people',
  'find people', 'finding people',
  'make friends', 'making friends',
  'meetup with', 'meet up with',
  'socialize with', 'socializing with',
  'network with', 'networking with',
  'get to know', 'getting to know'
];

// Interface for query analysis result
interface QueryAnalysisResult {
  id?: string | null;
  intent: QueryIntent; // Using the locally defined QueryIntent type
  topics: string[];
  locations: string[];
  entities: Record<string, string[]>;
}

/**
 * Detects if a query is related to social connection
 * @param query The search query text
 * @returns True if the query contains social connection patterns
 */
export function isSocialConnectionQuery(query: string): boolean {
  // Normalize the query to lowercase for case-insensitive matching
  const normalizedQuery = query.toLowerCase();
  
  // Check if query contains any social connection patterns
  return SOCIAL_CONNECTION_PATTERNS.some(pattern => 
    normalizedQuery.includes(pattern)
  );
}

/**
 * Enhances the intent detection by overriding the intent for social connection queries
 * @param query The original search query
 * @param analysisResult The original analysis result
 * @returns Enhanced analysis result with potentially modified intent
 */
export function enhanceIntentDetection(
  query: string, 
  analysisResult: QueryAnalysisResult
): QueryAnalysisResult {
  // If this is not a social connection query or already has how_to intent, return as is
  if (!isSocialConnectionQuery(query) || analysisResult.intent === 'how_to') {
    return analysisResult;
  }
  
  // Create a deep copy of the analysis result to avoid mutations
  const enhancedResult = JSON.parse(JSON.stringify(analysisResult));
  
  // Override the intent to "how_to" for social connection queries
  enhancedResult.intent = 'how_to';
  
  // Add "meeting people" to topics if not already present
  if (!enhancedResult.topics.includes('meeting people')) {
    enhancedResult.topics.push('meeting people');
  }
  
  // Return the enhanced result
  return enhancedResult;
}

// Example usage in the Supabase Edge Function:
/*
import { enhanceIntentDetection } from './enhanced-intent-detection';

// Inside your query-analysis edge function:
const rawAnalysisResult = await performOriginalQueryAnalysis(query);
const enhancedResult = enhanceIntentDetection(query, rawAnalysisResult);
return enhancedResult;
*/ 