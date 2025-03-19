import { supabaseAdmin } from '../supabase/client-server';
import { QueryAnalysisResult, EmbeddingResult, SearchResult } from '../supabase/types';
import { ApiError } from '../utils/error-handling';
import { SearchOptions } from './types';

// Simple in-memory cache for search results
// In production, consider using Redis or a similar distributed cache
type CacheEntry = {
  timestamp: number;
  results: SearchResult[];
  analysis: QueryAnalysisResult;
};

const SEARCH_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of entries to prevent memory leaks

/**
 * Creates a cache key from search options
 */
function createCacheKey(options: SearchOptions): string {
  return `${options.query.toLowerCase()}_${options.maxResults || 20}_${options.similarityThreshold || 0.6}`;
}

/**
 * Cleans up old entries from the cache
 */
function cleanupCache(): void {
  const now = Date.now();
  
  // Remove entries older than TTL
  for (const [key, entry] of SEARCH_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      SEARCH_CACHE.delete(key);
    }
  }
  
  // If still too many entries, remove oldest ones
  if (SEARCH_CACHE.size > MAX_CACHE_SIZE) {
    const entries = Array.from(SEARCH_CACHE.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      SEARCH_CACHE.delete(key);
    }
  }
}

/**
 * Analyzes a search query to extract intent, entities, topics, and locations
 * @param query The user's search query
 * @returns Structured analysis of the query
 */
export async function analyzeQuery(query: string): Promise<QueryAnalysisResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('query-analysis', {
      body: { query }
    });
    
    if (error) {
      throw new ApiError(`Query analysis failed: ${error.message}`, 500);
    }
    
    if (!data) {
      throw new ApiError('No analysis data returned', 500);
    }
    
    return data as QueryAnalysisResult;
  } catch (error) {
    console.error('Error in query analysis:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to analyze query', 500);
  }
}

/**
 * Generates embeddings for a search query
 * @param query The user's search query
 * @returns Embedding vector for the query
 */
export async function generateEmbeddings(query: string): Promise<EmbeddingResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('query-embeddings', {
      body: { query }
    });
    
    if (error) {
      throw new ApiError(`Embedding generation failed: ${error.message}`, 500);
    }
    
    if (!data || !data.embedding) {
      throw new ApiError('No embedding data returned', 500);
    }
    
    return data as EmbeddingResult;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to generate embeddings', 500);
  }
}

/**
 * Executes the multi-strategy search with the given parameters
 * @param query The original search query
 * @param queryEmbedding The embedding vector for the query
 * @param queryIntent The detected intent of the query
 * @param queryTopics The detected topics in the query
 * @param queryLocations The detected locations in the query
 * @param maxResults Maximum number of results to return
 * @param matchThreshold Similarity threshold for matching
 * @returns Array of search results
 */
export async function executeSearch(
  query: string,
  queryEmbedding: number[],
  queryIntent: string,
  queryTopics: string[],
  queryLocations: string[],
  maxResults: number = 20,
  matchThreshold: number = 0.6
): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('multi_strategy_search', {
      p_query: query,
      p_query_embedding: queryEmbedding,
      p_query_intent: queryIntent,
      p_query_topics: queryTopics || [],
      p_query_locations: queryLocations || [],
      p_max_results: maxResults,
      p_match_threshold: matchThreshold
    });
    
    if (error) {
      throw new ApiError(`Search execution failed: ${error.message}`, 500);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error executing search:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to execute search', 500);
  }
}

/**
 * Complete search flow that handles all steps: analysis, embeddings, and search
 * @param options Search options
 * @returns Search results and analysis
 */
export async function performFullSearch(options: SearchOptions) {
  const { 
    query, 
    maxResults = 20, 
    includeAnalysis = true,
    similarityThreshold = 0.6,
    subreddits = [],
    useMetadataBoost = true,
    useFallback = true,
    skipCache = false
  } = options;

  // Check cache first if not explicitly skipped
  if (!skipCache) {
    const cacheKey = createCacheKey(options);
    const cachedResult = SEARCH_CACHE.get(cacheKey);
    
    if (cachedResult) {
      console.log('Cache hit for query:', query);
      return {
        results: cachedResult.results,
        analysis: includeAnalysis ? cachedResult.analysis : undefined,
        query,
        cached: true
      };
    }
  }

  // Start both analysis and embedding generation concurrently
  const [analysis, embeddingResult] = await Promise.all([
    analyzeQuery(query),
    generateEmbeddings(query)
  ]);
  
  // Step 3: Execute search with the analysis and embeddings
  const searchResults = await executeSearch(
    query,
    embeddingResult.embedding,
    analysis.intent,
    analysis.topics,
    analysis.locations,
    maxResults,
    similarityThreshold
  );
  
  // Store in cache
  const cacheKey = createCacheKey(options);
  SEARCH_CACHE.set(cacheKey, {
    timestamp: Date.now(),
    results: searchResults,
    analysis
  });
  
  // Clean up cache occasionally
  if (Math.random() < 0.1) { // 10% chance to run cleanup
    cleanupCache();
  }
  
  return {
    results: searchResults,
    analysis: includeAnalysis ? analysis : undefined,
    query,
    cached: false
  };
} 