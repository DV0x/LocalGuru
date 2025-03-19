import { NextRequest } from 'next/server';
import { performFullSearch } from '@/app/lib/search/query-processor';
import { formatSearchResults } from '@/app/lib/search/result-formatter';
import { successResponse, errorResponse } from '@/app/lib/utils/api-response';
import { handleApiError, logApiError } from '@/app/lib/utils/error-handling';
import { SearchOptions } from '@/app/lib/search/types';

/**
 * Main search API endpoint that orchestrates the entire search process:
 * 1. Query analysis
 * 2. Embedding generation
 * 3. Multi-strategy search
 * 4. Result formatting
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Validate query
    if (!body.query || typeof body.query !== 'string') {
      return errorResponse('Query is required and must be a string', 400);
    }
    
    // Create search options from request
    const options: SearchOptions = {
      query: body.query,
      maxResults: body.maxResults || 20,
      includeAnalysis: body.includeAnalysis !== false, // Default to true
      similarityThreshold: body.similarityThreshold || 0.6,
      subreddits: body.subreddits,
      useMetadataBoost: body.useMetadataBoost !== false, // Default to true
      useFallback: body.useFallback !== false, // Default to true
      skipCache: body.skipCache === true // Default to false (use cache)
    };
    
    // Log the search request (without sensitive data)
    console.log('Search request:', { 
      query: options.query,
      maxResults: options.maxResults,
      timestamp: new Date().toISOString()
    });
    
    // Perform the full search flow
    const result = await performFullSearch(options);
    
    // Format results for the frontend
    const formattedResults = formatSearchResults(result.results);
    
    // Calculate performance metrics
    const processingTime = Date.now() - startTime;
    
    // Log performance metrics
    console.log('Search performance:', {
      query: options.query.substring(0, 30) + (options.query.length > 30 ? '...' : ''),
      processingTime: `${processingTime}ms`,
      resultCount: result.results.length,
      cached: result.cached || false
    });
    
    // Return formatted response along with raw results for inspection
    return successResponse({
      results: formattedResults,
      query: result.query,
      analysis: result.analysis,
      totalResults: result.results.length,
      cached: result.cached || false,
      processingTime,
      // Include raw results for debugging
      // rawResults: result.results, // Removing raw results to make responses more concise for LLMs
    });
  } catch (error) {
    logApiError('search API', error);
    return handleApiError(error);
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 