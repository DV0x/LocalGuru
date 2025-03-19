/**
 * Utility functions for standardized API responses
 */

/**
 * Creates a standardized success response
 */
export function successResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates a standardized error response
 */
export function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
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