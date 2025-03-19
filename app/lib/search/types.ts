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
  maxResults?: number;
  includeAnalysis?: boolean;
  similarityThreshold?: number;
  subreddits?: string[];
  useMetadataBoost?: boolean;
  useFallback?: boolean;
  skipCache?: boolean;
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