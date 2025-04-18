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