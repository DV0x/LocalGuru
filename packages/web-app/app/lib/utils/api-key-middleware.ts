import { NextRequest, NextResponse } from 'next/server';
import { validateInternalApiKey } from './api-key-validator';

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