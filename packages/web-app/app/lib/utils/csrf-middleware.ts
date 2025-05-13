import { NextRequest, NextResponse } from 'next/server';
import { validateCsrfToken } from './csrf';

/**
 * Middleware to validate CSRF tokens in POST, PUT, PATCH, and DELETE requests
 * @returns Response with 403 status if CSRF validation fails, or passes through to next handler if successful
 */
export async function csrfProtection(req: NextRequest) {
  // Only apply CSRF protection to state-changing methods
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!protectedMethods.includes(req.method)) {
    // Pass through for safe methods like GET, HEAD, OPTIONS
    return null;
  }
  
  // Check for CSRF token in headers
  const csrfToken = req.headers.get('X-CSRF-Token');
  
  // Skip csrf protection for API endpoints that require external access (e.g., webhooks)
  // Add exceptions here if needed
  const skipCsrfUrls = [
    '/api/webhooks/',
    '/api/external/'
  ];
  
  if (skipCsrfUrls.some(url => req.nextUrl.pathname.startsWith(url))) {
    return null;
  }
  
  // Validate the CSRF token
  if (!csrfToken || !(await validateCsrfToken(csrfToken))) {
    return new NextResponse(
      JSON.stringify({ 
        error: 'Invalid CSRF token',
        code: 'csrf_error' 
      }),
      { 
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  
  // Token is valid, request can proceed
  return null;
} 