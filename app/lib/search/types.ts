import { SearchResult, QueryAnalysisResult } from '../supabase/types';

/**
 * Frontend-friendly search result type that matches the TravelRecommendation interface
 * used in components/result-card.tsx
 */
export interface FormattedSearchResult {
  id: string;
  title: string;
  location: string;
  description: string;
  tags: string[];
  source: string;
  sourceUrl: string;
  similarity?: number;
  matchType?: string;
  metadata?: any; // Raw metadata for debugging
}

/**
 * Options for performing a search
 */
export interface SearchOptions {
  query: string;
  maxResults?: number;     // Maximum number of results to return (default 50)
  includeAnalysis?: boolean;
  similarityThreshold?: number;
  subreddits?: string[];
  useMetadataBoost?: boolean;
  useFallback?: boolean;
  skipCache?: boolean;
  defaultLocation?: string; // Default location from LocationSelector
  // Parameters for hybrid search
  vectorWeight?: number;   // Weight for vector similarity (default 0.7)
  textWeight?: number;     // Weight for text search score (default 0.3)
  efSearch?: number;       // HNSW index search parameter (default 100)
}

/**
 * Response structure for search API endpoints
 */
export interface SearchResponse {
  results: FormattedSearchResult[];
  analysis?: QueryAnalysisResult;
  query: string;
  totalResults?: number;
  cached?: boolean;
  // rawResults?: SearchResult[]; // Removed for more concise LLM-friendly responses
}

/**
 * Options for submitting user feedback
 */
export interface FeedbackOptions {
  contentId: string;
  query: string;
  isHelpful: boolean;
  feedbackSource?: string;
  userComments?: string;
}

/**
 * Parameters for direct content representation search
 */
export interface ContentRepresentationSearchParams {
  query: string;
  query_embedding: number[];
  representation_types: string[];
  max_results?: number;
  similarity_threshold?: number;
  subreddits?: string[];
  metadata_boost?: boolean;
  use_fallback?: boolean;
  debug?: boolean;
} 