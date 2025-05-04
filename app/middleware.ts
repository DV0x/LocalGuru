import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { csrfProtection } from './lib/utils/csrf-middleware';

/**
 * In-memory cache for tracking rate limits
 * In a production environment, consider using Redis or similar
 * for distributed rate limiting across multiple servers
 */
const API_CACHE = new Map<string, { count: number, timestamp: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS = parseInt(process.env.API_RATE_LIMIT || '60', 10); // 60 requests per window by default

// Request size limit configuration
const MAX_REQUEST_SIZE = parseInt(process.env.MAX_REQUEST_SIZE || '1048576', 10); // 1MB default size limit

/**
 * Middleware function that provides:
 * 1. Security headers for all responses
 * 2. Rate limiting for API routes
 * 3. Request size limiting for API routes
 * 4. CSRF protection for state-changing API routes
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add security headers to all responses
  addSecurityHeaders(response);
  
  // Apply limits only to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Check for CSRF protection first (for state-changing methods)
    const csrfResult = await csrfProtection(request);
    if (csrfResult) {
      return csrfResult; // Return if CSRF validation failed
    }
    
    // Check request size limit
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    
    if (contentLength > MAX_REQUEST_SIZE) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Request entity too large',
          limit: `${MAX_REQUEST_SIZE} bytes`,
          received: `${contentLength} bytes`
        }),
        {
          status: 413, // Payload Too Large
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    // Then apply rate limit
    return applyRateLimit(request, response);
  }
  
  return response;
}

/**
 * Add security headers to the response
 */
function addSecurityHeaders(response: NextResponse): void {
  // Basic security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
  );
  
  // Permissions Policy (formerly Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  );
}

/**
 * Apply rate limiting to the request
 */
function applyRateLimit(request: NextRequest, response: NextResponse): NextResponse {
  // Get a unique identifier for the client (IP address or API key)
  // Use X-Forwarded-For header or fallback to a default value
  const forwardedFor = request.headers.get('X-Forwarded-For');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  const clientId = request.headers.get('X-API-Key') || clientIp;
  
  const now = Date.now();
  
  // Get or initialize rate limit data for this client
  const rateData = API_CACHE.get(clientId) || { count: 0, timestamp: now };
  
  // Reset if outside the rate limit window
  if (now - rateData.timestamp > RATE_LIMIT_WINDOW) {
    rateData.count = 0;
    rateData.timestamp = now;
  }
  
  // Increment request count
  rateData.count += 1;
  API_CACHE.set(clientId, rateData);
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', MAX_REQUESTS.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - rateData.count).toString());
  response.headers.set('X-RateLimit-Reset', (rateData.timestamp + RATE_LIMIT_WINDOW).toString());
  
  // Return 429 Too Many Requests if rate limit exceeded
  if (rateData.count > MAX_REQUESTS) {
    // Clean up old entries periodically
    cleanupRateLimitCache();
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateData.timestamp + RATE_LIMIT_WINDOW - now) / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateData.timestamp + RATE_LIMIT_WINDOW - now) / 1000).toString(),
          // Keep the rate limit headers
          'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit') || '',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': response.headers.get('X-RateLimit-Reset') || ''
        }
      }
    );
  }
  
  return response;
}

/**
 * Clean up old entries in the rate limit cache
 * to prevent memory leaks
 */
function cleanupRateLimitCache(): void {
  const now = Date.now();
  
  // Remove entries older than twice the rate limit window
  for (const [clientId, data] of API_CACHE.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW * 2) {
      API_CACHE.delete(clientId);
    }
  }
}

/**
 * Configure which routes the middleware applies to
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}; 