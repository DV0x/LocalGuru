/**
 * Utility for validating origins of API requests
 */

// List of allowed origins for the API
// You should customize this list to include your PWA domains
const ALLOWED_ORIGINS = [
  // Development environments
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  
  // Production environments
  'https://localguru.ai',
  'https://www.localguru.ai',
  'https://pwa.localguru.ai',
  'https://app.localguru.ai',
  
  // Add any other domains that should be allowed to access the API
];

/**
 * Checks if the origin of a request is allowed
 * @param origin The origin header from the request
 * @returns Boolean indicating if the origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  // For EventSource in development, sometimes the origin is null
  // Allow requests with no origin in development mode
  if (!origin) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Allowing null origin request in development mode');
      return true;
    }
    return false;
  }
  
  // Check if the origin is in the allowed list
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Gets the appropriate CORS headers based on the origin
 * @param origin The origin header from the request
 * @returns Object with CORS headers
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // If the origin is allowed, return CORS headers permitting that origin
  if (origin && isAllowedOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin', // Important when using dynamic CORS origins
    };
  }
  
  // If the origin is not allowed, return basic headers without CORS permissions
  return {
    'Content-Type': 'application/json',
  };
} 