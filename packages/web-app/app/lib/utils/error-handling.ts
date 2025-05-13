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