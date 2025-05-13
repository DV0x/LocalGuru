import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Types
interface SearchOptions {
  limit?: number;
  offset?: number;
  subreddits?: string[];
  metadata_boost?: boolean;
  use_fallback?: boolean;
  debug?: boolean;
  similarity_threshold?: number; // Added threshold parameter
  includeAnalysis?: boolean;
}

interface EnhancedSearchRequest {
  query: string;
  embeddings?: number[]; // Optional pre-generated embeddings
  options?: SearchOptions;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Logging function
const log = (message: string, data?: any) => {
  console.log(`[enhanced-search] ${message}`, data ? JSON.stringify(data) : '');
};

console.info('Enhanced Search function started');

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const input: EnhancedSearchRequest = await req.json();
    const { query, embeddings, options = {} } = input;
    
    log('Search request received', { query, hasEmbeddings: !!embeddings, options });
    
    if (!query || query.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Query is required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // 1. Analyze query to determine intent, entities, etc.
    log('Analyzing query', { query });
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke('query-analysis', {
      body: { query }
    });
    
    if (analysisError) {
      log('Query analysis error', analysisError);
      // Continue with search even if analysis fails
    }
    
    const analysis = analysisError ? null : analysisData;
    log('Query analysis result', analysis);

    // 2. Get query embeddings using the query-embeddings Edge Function (or use provided embeddings)
    let queryEmbedding;
    let embeddingSource = 'provided';
    
    if (embeddings && Array.isArray(embeddings) && embeddings.length === 1536) {
      // Use the provided embeddings
      queryEmbedding = embeddings;
      log('Using provided embeddings for search');
    } else {
      // Generate embeddings using query-embeddings Edge Function
      log('Generating embeddings using query-embeddings function');
      try {
        const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('query-embeddings', {
          body: { 
            query,
            storeInCache: true
          }
        });
        
        if (embeddingError) {
          throw new Error(`Failed to generate embeddings: ${embeddingError.message}`);
        }
        
        if (!embeddingData || !embeddingData.embedding) {
          throw new Error('No embedding returned from query-embeddings function');
        }
        
        queryEmbedding = embeddingData.embedding;
        embeddingSource = embeddingData.cached ? 'cache' : embeddingData.source_model;
        log('Successfully generated embeddings', { 
          source: embeddingSource,
          dimensions: queryEmbedding.length
        });
      } catch (error) {
        log('Error generating embeddings', error);
        // Fall back to null embedding (will trigger text search later)
        queryEmbedding = null;
      }
    }

    // 3. Perform search with appropriate function based on representation types
    let searchResults;
    let searchError;
    let searchType = 'unknown';
    
    try {
      // Set a lower similarity threshold based on our observed embedding distribution
      const similarityThreshold = options.similarity_threshold || 0.6; // Default to 0.6 for better quality
      
      if (queryEmbedding) {
        log('Executing search_content_multi_strategy with embeddings');
        
        // Generate query analysis if needed
        let queryAnalysis = null;
        if (options.includeAnalysis === true) {
          try {
            const analysisResponse = await fetch(`${corsHeaders.origin}/functions/v1/query-analysis`, {
              method: 'POST',
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || '',
              },
              body: JSON.stringify({ query })
            });
            
            if (analysisResponse.ok) {
              const analysisData = await analysisResponse.json();
              queryAnalysis = analysisData.analysis;
              log('Query analysis', queryAnalysis);
            }
          } catch (e) {
            log('Error getting query analysis, continuing without it', e);
          }
        }
        
        const searchOptions = {
          query,
          query_embedding: queryEmbedding,
          analysis: queryAnalysis,
          max_results: options.limit || 20,
          result_offset: options.offset || 0,
          subreddits: options.subreddits,
          metadata_boost: options.metadata_boost !== false, // Default to true
          use_fallback: options.use_fallback !== false, // Default to true
          debug: options.debug || false
        };
        
        log('Search parameters', searchOptions);
        
        try {
          const response = await supabase.rpc(
            'search_content_multi_strategy',
            searchOptions
          );
          
          searchResults = response.data;
          searchError = response.error;
          searchType = 'multi_strategy';
          
          // Log search quality metrics
          if (searchResults && searchResults.length > 0) {
            const topScore = searchResults[0].match_score;
            log(`Top result match score: ${topScore}`);
          }
        } catch (e) {
          log('Multi-strategy search error:', e);
          searchError = e;
          
          // Try fallback to search_content_representations
          log('Falling back to search_content_representations');
          try {
            const representationsResponse = await supabase.rpc(
              'search_content_representations',
              {
                query,
                query_embedding: queryEmbedding,
                representation_types: ['basic', 'context_enhanced', 'title'],
                max_results: options.limit || 20,
                result_offset: options.offset || 0,
                subreddits: options.subreddits,
                metadata_boost: options.metadata_boost !== false,
                use_fallback: true,
                debug: options.debug || false
              }
            );
            
            searchResults = representationsResponse.data;
            searchError = representationsResponse.error;
            searchType = 'vector_representations';
          } catch (fallbackError) {
            log('Fallback search also failed:', fallbackError);
            searchError = fallbackError;
          }
        }
      }
      
      // If vector search failed or found no results, fall back to text search
      if (!queryEmbedding || searchError || !searchResults || searchResults.length === 0) {
        if (options.use_fallback !== false) { // Default to true
          log('Vector search failed or found no results, falling back to text search');
          
          // Perform a simple text search using the query
          const { data: textSearchResults, error: textSearchError } = await supabase.rpc(
            'simple_text_search',
            {
              search_query: query,
              max_results: options.limit || 20
            }
          );
          
          if (textSearchError) {
            log('Text search also failed', textSearchError);
            searchError = textSearchError;
          } else {
            log(`Text search found ${textSearchResults?.length || 0} results`);
            searchResults = textSearchResults || [];
            searchError = null;
            searchType = 'text_search';
          }
        }
      }
    } catch (error) {
      log('Search execution error', error);
      searchError = error;
    }
    
    if (searchError) {
      log('Search error', searchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          query,
          analysis,
          error: `Search error: ${searchError.message || 'Unknown error'}`,
          details: searchError
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
    
    // 4. Return results
    const results = searchResults || [];
    log(`Search completed with ${results.length} results using ${searchType} search`);
    
    return new Response(
      JSON.stringify({
        success: true,
        query,
        analysis,
        results,
        searchType,
        embeddingSource,
        stats: {
          resultCount: results.length,
          topScore: results.length > 0 ? results[0].match_score : null,
          analysisAvailable: !!analysis
        },
        details: options.debug ? { options } : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    log('Unexpected error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unexpected error: ${error.message || 'Unknown error'}`,
        details: String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}); 