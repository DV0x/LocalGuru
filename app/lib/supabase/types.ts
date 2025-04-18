/**
 * Supabase-specific type definitions related to our search system
 */

/**
 * Result structure from the query-analysis edge function
 */
export interface QueryAnalysisResult {
  query: string;
  entities: {
    [key: string]: string[];
  };
  topics: string[];
  locations: string[];
  intent: 'recommendation' | 'information' | 'comparison' | 'experience' | 'local_events' | 'how_to' | 'discovery' | 'general';
  enhancedQueries?: string[];
}

/**
 * Result structure from the query-embeddings edge function
 */
export interface EmbeddingResult {
  query: string;
  embedding: number[]; // 512-dimensional vector (was previously 1536)
  cached?: boolean;
  created_at?: string;
  source_model?: string; // The model used to generate the embedding
  dimensions?: number; // The dimensionality of the embedding (512 or 1536)
}

/**
 * Represents the result structure from the multi_strategy_search function
 * Matches the SQL function output columns in enhanced_intent_multi_strategy_search.sql
 */
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  content_snippet: string;
  url: string;
  subreddit: string;
  author: string;
  content_type: string; // 'post' or 'comment'
  created_at: string;
  similarity: number;
  match_type: string; // 'basic', 'title', 'context_enhanced', 'location_boosted', 'topic_boosted', etc.
  metadata: {
    topics?: string[];
    locations?: string[];
    entities?: Record<string, string[]>;
    type?: string;
    length?: number;
    semanticTags?: string[];
    tokenEstimate?: number;
    thread_context?: {
      path?: string[];
      depth?: number;
      postId?: string;
      parentId?: string;
      postTitle?: string;
      subreddit?: string;
      parentComments?: string[];
    };
  };
  permalink?: string;
} 