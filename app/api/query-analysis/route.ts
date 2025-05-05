


/**
 * Middleware to protect sensitive internal endpoints with API key validation
 * @param request The NextRequest object
 * @returns NextResponse or null if validation passes
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  // Extract API key from headers
  const apiKey = request.headers.get('X-API-Key');
  
  // Validate the API key
  if (!validateInternalApiKey(apiKey)) {
    // If validation fails, return 401 Unauthorized
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  
  // If validation passes, return null to continue processing
  return null;
}

/**
 * Wraps a Next.js API route handler with API key validation
 * @param handler The API route handler function
 * @returns A new handler with API key validation
 */
export function withApiKeyValidation(handler: Function) {
  return async function(request: NextRequest, ...args: any[]) {
    // Validate the API key
    const validationResponse = validateApiKey(request);
    
    // If validation fails, return the error response
    if (validationResponse) {
      return validationResponse;
    }
    
    // If validation passes, call the original handler
    return handler(request, ...args);
  };
} 

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
import { analyzeQuery } from '../utils/search/query-processor';




/**
 * API route for analyzing search queries
 * Proxies requests to the Supabase edge function securely
 * Protected by API key validation
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Validate query
    if (!body.query || typeof body.query !== 'string') {
      return errorResponse('Query is required and must be a string', 400);
    }
    
    // Log the analysis request (without sensitive data)
    console.log('Query analysis request:', { 
      query: body.query,
      timestamp: new Date().toISOString()
    });
    
    // Call the query analysis function
    const analysis = await analyzeQuery(body.query);
    
    // Return the analysis result
    return successResponse({ analysis });
  } catch (error) {
    logApiError('query-analysis API', error);
    return handleApiError(error);
  }
}

/**
 * Wrap the handler with API key validation middleware
 */
export const POST = withApiKeyValidation(handler);

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    }
  });
} 