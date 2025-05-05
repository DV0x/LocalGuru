import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../utils/supabase/client-server';
import { performFullSearch } from '../utils/search/query-processor';
import { SearchResult } from '../utils/supabase/types';

/**
 * Comprehensive test endpoint for debugging search functionality
 */
export async function GET() {
  const testQuery = 'restaurant';
  const results: Record<string, any> = {
    testQueryUsed: testQuery,
    tests: {},
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Get database stats
    console.log('TEST: Checking database content...');
    try {
      // Check content table
      const { data: contentData, count: contentCount, error: contentError } = await supabaseAdmin
        .from('content')
        .select('*', { count: 'exact', head: true });

      // Check representations table  
      const { data: repData, count: repCount, error: repError } = await supabaseAdmin
        .from('content_representations')
        .select('*', { count: 'exact', head: true });

      results.tests.databaseStats = {
        success: !contentError && !repError,
        contentCount: contentCount || 0,
        representationsCount: repCount || 0,
        errors: contentError || repError ? {
          content: contentError?.message,
          representations: repError?.message
        } : null
      };

      console.log(`TEST: Database contains ${results.tests.databaseStats.contentCount} content items and ${results.tests.databaseStats.representationsCount} representations`);
    } catch (error) {
      results.tests.databaseStats = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('TEST: Error checking database stats:', error);
    }

    // Step 2: Test query analysis
    console.log('TEST: Testing query analysis...');
    try {
      const { data: analysisData, error: analysisError } = await supabaseAdmin.functions.invoke('query-analysis', {
        body: { query: testQuery }
      });

      results.tests.queryAnalysis = {
        success: !analysisError,
        data: analysisData || null,
        error: analysisError?.message || null
      };

      if (analysisData) {
        console.log(`TEST: Query analysis successful. Intent: ${analysisData.intent}, Topics: ${analysisData.topics?.join(', ')}`);
      } else {
        console.log('TEST: Query analysis failed');
      }
    } catch (error) {
      results.tests.queryAnalysis = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('TEST: Error in query analysis:', error);
    }

    // Step 3: Test embedding generation
    console.log('TEST: Testing embedding generation...');
    try {
      const { data: embeddingData, error: embeddingError } = await supabaseAdmin.functions.invoke('query-embeddings', {
        body: { query: testQuery }
      });

      results.tests.embeddingGeneration = {
        success: !embeddingError && embeddingData?.embedding?.length > 0,
        embeddingLength: embeddingData?.embedding?.length || 0,
        embeddingSource: embeddingData?.source_model || null,
        error: embeddingError?.message || null
      };

      if (embeddingData?.embedding) {
        console.log(`TEST: Embedding generation successful. Length: ${embeddingData.embedding.length}, Source: ${embeddingData.source_model || 'unknown'}`);
      } else {
        console.log('TEST: Embedding generation failed');
      }

      // Store embedding for later tests
      const embedding = embeddingData?.embedding;

      // Step 4: Test hybrid search with standard threshold
      if (embedding && results.tests.queryAnalysis.success) {
        console.log('TEST: Testing hybrid_search with threshold 0.6...');
        try {
          const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
            'timed_hybrid_search',
            {
              p_query: testQuery,
              p_query_embedding: embedding,
              p_query_intent: results.tests.queryAnalysis.data.intent || 'general',
              p_query_topics: results.tests.queryAnalysis.data.topics || [],
              p_query_locations: results.tests.queryAnalysis.data.locations || [],
              p_max_results: 10,
              p_match_threshold: 0.6,
              p_vector_weight: 0.7,
              p_text_weight: 0.3,
              p_ef_search: 100
            }
          );

          results.tests.hybridSearch = {
            success: !searchError,
            resultsCount: searchResults?.length || 0,
            sampleResults: searchResults?.slice(0, 2) || [],
            error: searchError?.message || null
          };

          console.log(`TEST: Hybrid search returned ${searchResults?.length || 0} results with threshold 0.6`);
        } catch (error) {
          results.tests.hybridSearch = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          console.error('TEST: Error in hybrid search:', error);
        }

        // Step 5: Test with lower threshold
        console.log('TEST: Testing hybrid_search with threshold 0.4...');
        try {
          const { data: searchResultsLower, error: searchErrorLower } = await supabaseAdmin.rpc(
            'timed_hybrid_search',
            {
              p_query: testQuery,
              p_query_embedding: embedding,
              p_query_intent: results.tests.queryAnalysis.data.intent || 'general',
              p_query_topics: results.tests.queryAnalysis.data.topics || [],
              p_query_locations: results.tests.queryAnalysis.data.locations || [],
              p_max_results: 10,
              p_match_threshold: 0.4,
              p_vector_weight: 0.7,
              p_text_weight: 0.3,
              p_ef_search: 100
            }
          );

          results.tests.hybridSearchLower = {
            success: !searchErrorLower,
            resultsCount: searchResultsLower?.length || 0,
            sampleResults: searchResultsLower?.slice(0, 2) || [],
            error: searchErrorLower?.message || null
          };

          console.log(`TEST: Hybrid search returned ${searchResultsLower?.length || 0} results with threshold 0.4`);
        } catch (error) {
          results.tests.hybridSearchLower = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          console.error('TEST: Error in hybrid search with lower threshold:', error);
        }

        // Step 6: Test with different vector/text weights
        console.log('TEST: Testing hybrid_search with different weights...');
        try {
          const { data: weightResults, error: weightError } = await supabaseAdmin.rpc(
            'timed_hybrid_search',
            {
              p_query: testQuery,
              p_query_embedding: embedding,
              p_query_intent: results.tests.queryAnalysis.data.intent || 'general',
              p_query_topics: results.tests.queryAnalysis.data.topics || [],
              p_query_locations: results.tests.queryAnalysis.data.locations || [],
              p_max_results: 10,
              p_match_threshold: 0.4,
              p_vector_weight: 0.5,  // Equal weighting
              p_text_weight: 0.5,    // Equal weighting
              p_ef_search: 100
            }
          );

          results.tests.hybridSearchWeights = {
            success: !weightError,
            resultsCount: weightResults?.length || 0,
            sampleResults: weightResults?.slice(0, 2) || [],
            vectorWeight: 0.5,
            textWeight: 0.5,
            error: weightError?.message || null
          };

          console.log(`TEST: Hybrid search with equal weights returned ${weightResults?.length || 0} results`);
        } catch (error) {
          results.tests.hybridSearchWeights = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          console.error('TEST: Error in hybrid search with different weights:', error);
        }
      }

      // Step 7: Test the actual performFullSearch function
      console.log('TEST: Testing full search flow...');
      try {
        const fullSearchResult = await performFullSearch({
          query: testQuery,
          maxResults: 10,
          includeAnalysis: true,
          skipCache: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          efSearch: 100
        });

        results.tests.fullSearch = {
          success: true,
          resultsCount: fullSearchResult.results?.length || 0,
          analysisIncluded: !!fullSearchResult.analysis,
          sampleResults: fullSearchResult.results?.slice(0, 2) || [],
          vectorWeight: 0.7,
          textWeight: 0.3,
          efSearch: 100
        };

        console.log(`TEST: Full search returned ${fullSearchResult.results?.length || 0} results`);
      } catch (error) {
        results.tests.fullSearch = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.error('TEST: Error in full search:', error);
      }
    } catch (embeddingError) {
      results.tests.embeddingGeneration = {
        success: false,
        error: embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
      };
      console.error('TEST: Error in embedding generation:', embeddingError);
    }

    // Add diagnosis and recommendations
    results.diagnosis = determineIssue(results);
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('TEST: Error running tests:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Determines the likely issue based on test results
 */
function determineIssue(results: Record<string, any>): string[] {
  const issues: string[] = [];

  // Check database content
  if (!results.tests.databaseStats.success) {
    issues.push('Database connection issue: Unable to verify content exists in the database.');
  } else if (results.tests.databaseStats.contentCount === 0) {
    issues.push('No content found in database: The content table is empty.');
  } else if (results.tests.databaseStats.representationsCount === 0) {
    issues.push('No content representations found: The content_representations table is empty.');
  }

  // Check query analysis
  if (!results.tests.queryAnalysis.success) {
    issues.push('Query analysis failed: Unable to analyze the search query.');
  }

  // Check embedding generation
  if (!results.tests.embeddingGeneration.success) {
    issues.push('Embedding generation failed: Unable to create embedding vectors for the query.');
  } else if (results.tests.embeddingGeneration.embeddingLength === 0) {
    issues.push('Invalid embeddings: The generated embedding vector has zero length.');
  }

  // Check hybrid search
  if (results.tests.hybridSearch && !results.tests.hybridSearch.success) {
    issues.push('Hybrid search error: The search function returned an error.');
  } else if (results.tests.hybridSearch && results.tests.hybridSearch.resultsCount === 0) {
    if (results.tests.hybridSearchLower && results.tests.hybridSearchLower.resultsCount > 0) {
      issues.push('Threshold too high: Results found with lower threshold but not with standard threshold.');
    } else if (results.tests.hybridSearchWeights && results.tests.hybridSearchWeights.resultsCount > 0) {
      issues.push('Hybrid search issue: Different weights search returns results but hybrid search does not.');
    } else {
      issues.push('No matching content: No results found with any search method, content may not match the query semantically.');
    }
  }

  // Check full search flow
  if (results.tests.fullSearch && !results.tests.fullSearch.success) {
    issues.push('Full search flow error: The performFullSearch function returned an error.');
  } else if (results.tests.fullSearch && results.tests.fullSearch.resultsCount === 0 && 
            results.tests.hybridSearch && results.tests.hybridSearch.resultsCount > 0) {
    issues.push('Integration issue: Hybrid search returns results but full search flow does not.');
  }

  // If no specific issues found
  if (issues.length === 0) {
    if (results.tests.fullSearch && results.tests.fullSearch.resultsCount > 0) {
      issues.push('Search appears to be working correctly with results.');
    } else {
      issues.push('Unknown issue: Tests completed but no specific problem was identified.');
    }
  }

  return issues;
} 