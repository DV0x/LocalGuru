/**
 * Utility functions for API key validation
 */

/**
 * Validates if the provided API key matches the internal API key
 * @param apiKey The API key to validate
 * @returns Boolean indicating if the key is valid
 */
export function validateInternalApiKey(apiKey: string | null): boolean {
  if (!apiKey) {
    return false;
  }
  
  const internalApiKey = process.env.INTERNAL_API_KEY;
  
  if (!internalApiKey) {
    console.error('INTERNAL_API_KEY is not set in environment variables');
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(apiKey, internalApiKey);
}

/**
 * Performs a constant-time comparison of two strings to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns Boolean indicating if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
} 