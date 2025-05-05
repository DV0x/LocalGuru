/**
 * Error handling utilities for API routes
 */

/**
 * Custom API error with status code
 */
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * Central error handler for API routes
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error instanceof ApiError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Handle Supabase errors (they typically have a message property)
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = (error as { message: string }).message;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Default error response for unknown errors
  return new Response(
    JSON.stringify({ error: 'An unexpected error occurred' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Logger for API errors that ensures sensitive data isn't logged
 */
export function logApiError(context: string, error: unknown) {
  // Sanitize sensitive data if needed
  const sanitizedError = error instanceof Error 
    ? { name: error.name, message: error.message } 
    : { unknown: String(error) };
  
  console.error(`API Error in ${context}:`, sanitizedError);
} 

/**
 * Utility functions for standardized API responses
 */

/**
 * Creates a standardized success response
 */
export function successResponse(data: any, status = 200) {
  return Response.json(
    { 
      success: true, 
      ...data
    }, 
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      } 
    }
  );
}

/**
 * Creates a standardized error response
 */
export function errorResponse(message: string, status = 500) {
  return Response.json(
    { 
      success: false, 
      error: message
    }, 
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      } 
    }
  );
}

/**
 * Creates a standardized "not found" response
 */
export function notFoundResponse(message = 'Resource not found') {
  return errorResponse(message, 404);
}

/**
 * Creates a standardized "unauthorized" response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401);
}

/**
 * Creates a standardized timeout response
 */
export function timeoutResponse(message = 'Request timed out', partialResults?: any) {
  return Response.json(
    { 
      success: false, 
      error: message,
      partial: true,
      ...(partialResults ? { results: partialResults } : {})
    }, 
    { 
      status: 408,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      } 
    }
  );
} 

import { NextRequest } from 'next/server';
import { performFullSearch } from '../utils/search/query-processor';
import { formatSearchResults } from '../utils/search/result-formatter';


import { SearchOptions } from '../utils/search/types';

// Increase timeout for this API route to 30 seconds (default is 10 seconds)
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Main search API endpoint that orchestrates the entire search process:
 * 1. Query analysis
 * 2. Embedding generation
 * 3. Hybrid search
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
    
    // Create search options from request with new hybrid search parameters
    const options: SearchOptions = {
      query: body.query,
      maxResults: body.maxResults || 50,
      includeAnalysis: body.includeAnalysis !== false, // Default to true
      similarityThreshold: body.similarityThreshold || 0.6,
      subreddits: body.subreddits,
      useMetadataBoost: body.useMetadataBoost !== false, // Default to true
      useFallback: body.useFallback !== false, // Default to true
      skipCache: body.skipCache === true, // Default to false (use cache)
      // Add defaultLocation parameter
      defaultLocation: body.defaultLocation,
      // New parameters for hybrid search
      vectorWeight: body.vectorWeight || 0.7,    // Weight for vector similarity 
      textWeight: body.textWeight || 0.3,        // Weight for text search
      efSearch: body.efSearch || 300             // Updated to 300
    };
    
    // Log the search request (without sensitive data)
    console.log('Search request:', { 
      query: options.query,
      maxResults: options.maxResults,
      defaultLocation: options.defaultLocation || 'none',
      timestamp: new Date().toISOString(),
      // Log hybrid search parameters
      vectorWeight: options.vectorWeight,
      textWeight: options.textWeight,
      efSearch: options.efSearch
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
      cached: result.cached || false,
      partial: result.partial || false
    });
    
    // Check for partial results (from timeout)
    if (result.partial) {
      return timeoutResponse(
        'Search operation partially completed. Results may be incomplete.',
        formattedResults
      );
    }
    
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
    
    // Check for specific timeout errors
    if (error instanceof Error && 
        (error.message.includes('timeout') || error.message.includes('timed out'))) {
      return timeoutResponse('Search operation timed out. Please try a more specific query.');
    }
    
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Connection': 'keep-alive'
    }
  });
} 