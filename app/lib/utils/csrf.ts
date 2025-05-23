'use server';

import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';

// Set CSRF cookie options
const CSRF_COOKIE_NAME = 'csrf_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60, // 1 hour in seconds
};

/**
 * Generates a cryptographically secure random token and stores it in a cookie
 * Returns the token to be sent to the client for inclusion in subsequent requests
 */
export async function generateCsrfToken(): Promise<string> {
  // Generate a cryptographically secure random token
  const token = randomBytes(32).toString('hex');
  
  // Hash the token before storing it in the cookie
  const hashedToken = createHash('sha256').update(token).digest('hex');
  
  // Store the hashed token in a cookie
  cookies().set(CSRF_COOKIE_NAME, hashedToken, COOKIE_OPTIONS);
  
  // Return the unhashed token to the client
  return token;
}

/**
 * Validates a CSRF token against the stored token in the cookie
 * Returns true if the token is valid, false otherwise
 */
export async function validateCsrfToken(token: string): Promise<boolean> {
  if (!token) {
    return false;
  }
  
  // Get the hashed token from the cookie
  const storedToken = cookies().get(CSRF_COOKIE_NAME)?.value;
  
  if (!storedToken) {
    return false;
  }
  
  // Hash the provided token and compare with the stored token
  const hashedToken = createHash('sha256').update(token).digest('hex');
  
  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(hashedToken, storedToken);
}

/**
 * Constant-time comparison of two strings to prevent timing attacks
 * Returns true if the strings are equal, false otherwise
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

/**
 * Helper function to clear the CSRF token cookie
 */
export async function clearCsrfToken(): Promise<void> {
  cookies().delete(CSRF_COOKIE_NAME);
} 