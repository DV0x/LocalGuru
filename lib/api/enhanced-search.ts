import { createClient } from '@supabase/supabase-js';
import { QueryIntent } from './query-analysis';

// Environment variables for Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface SearchOptions {
  limit?: number;
  offset?: number;
  subreddits?: string[];
  metadata_boost?: boolean;
  use_fallback?: boolean;
  debug?: boolean;
}

export interface QueryAnalysis {
  intent?: string;
  entities?: string[];
  topics?: string[];
  locations?: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  content_type: string;
  content_snippet: string;
  content: string;
  url: string;
  created_at: string;
  match_score: number;
  match_type: string;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  analysis?: QueryAnalysis;
  results: SearchResult[];
  error?: string;
  details?: any;
}

// Function to get embeddings for a query
async function getQueryEmbeddings(query: string): Promise<number[] | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Call the query-embeddings edge function
    const { data, error } = await supabase.functions.invoke('query-embeddings', {
      body: {
        query,
        storeInCache: true
      }
    });
    
    if (error) {
      console.error('Error getting query embeddings:', error);
      return null;
    }
    
    return data.embedding;
  } catch (error) {
    console.error('Error in getQueryEmbeddings:', error);
    return null;
  }
}

/**
 * Enhanced search implementation that uses query analysis and embedding search
 */
export async function enhancedSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        query,
        results: [],
        error: 'Query cannot be empty'
      };
    }

    // Generate query embeddings directly from the client
    const embeddings = await getQueryEmbeddings(query);
    
    // Call the enhanced-search function with the query and its embeddings
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.functions.invoke('enhanced-search', {
      body: {
        query,
        embeddings, // Pass the pre-generated embeddings
        options
      }
    });

    if (error) {
      console.error('Error invoking enhanced search:', error);
      return {
        success: false,
        query,
        results: [],
        error: `Error: ${error.message || 'Unknown error'}`,
        details: error
      };
    }

    return {
      success: true,
      query,
      analysis: data.analysis,
      results: data.results || [],
      details: data.details
    };
  } catch (error: any) {
    console.error('Enhanced search error:', error);
    return {
      success: false,
      query,
      results: [],
      error: `Exception: ${error.message || 'Unknown error'}`,
      details: error
    };
  }
}

/**
 * Server-side implementation of enhanced search
 * This is used by the API route
 */
export async function enhancedSearchServer(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  return enhancedSearch(query, options);
} 