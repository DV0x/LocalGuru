/**
 * Combined utility functions for the embeddings API route
 * This file includes only the essential functions needed for the route to work
 */

import { NextRequest, NextResponse } from 'next/server';

// --- API Response Utilities ---

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

// --- Error Handling Utilities ---

/**
 * Central error handler for API routes
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = (error as { message: string }).message;
    return errorResponse(errorMessage, 500);
  }
  
  // Default error response for unknown errors
  return errorResponse('An unexpected error occurred', 500);
}

/**
 * Logger for API errors that ensures sensitive data isn't logged
 */
export function logApiError(context: string, error: unknown) {
  const sanitizedError = error instanceof Error 
    ? { name: error.name, message: error.message } 
    : { unknown: String(error) };
  
  console.error(`API Error in ${context}:`, sanitizedError);
}

// --- API Key Middleware ---

/**
 * Validates if the provided API key matches the internal API key
 */
function validateInternalApiKey(apiKey: string | null): boolean {
  if (!apiKey) {
    return false;
  }
  
  const internalApiKey = process.env.INTERNAL_API_KEY;
  
  if (!internalApiKey) {
    console.error('INTERNAL_API_KEY is not set in environment variables');
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < apiKey.length && i < internalApiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ internalApiKey.charCodeAt(i);
  }
  
  return result === 0 && apiKey.length === internalApiKey.length;
}

/**
 * Middleware to validate API key
 */
function validateApiKey(request: NextRequest): NextResponse | null {
  // Extract API key from headers
  const apiKey = request.headers.get('X-API-Key');
  
  // Validate the API key
  if (!validateInternalApiKey(apiKey)) {
    // If validation fails, return 401 Unauthorized
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    );
  }
  
  // If validation passes, return null to continue processing
  return null;
}

/**
 * Wraps a Next.js API route handler with API key validation
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