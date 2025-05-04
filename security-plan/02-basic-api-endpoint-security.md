# Basic API Endpoint Security Plan

This plan focuses on securing your API endpoints without requiring user authentication.

## 1. Rate Limiting Implementation

### Priority: Critical
### Timeline: Immediate (within 24 hours of deployment)

Your middleware already has rate limiting, but let's enhance it:

1. **Deploy Redis for distributed rate limiting:**
   ```bash
   # Install Redis package
   npm install ioredis
   ```

2. **Update middleware.ts to use Redis:**
   ```typescript
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   import Redis from 'ioredis';

   // Configure Redis client
   const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

   // Rate limit configuration
   const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
   const MAX_REQUESTS = parseInt(process.env.API_RATE_LIMIT || '60', 10);

   export async function middleware(request: NextRequest) {
     const response = NextResponse.next();
     
     // Add security headers
     addSecurityHeaders(response);
     
     // Apply rate limiting only to API routes
     if (request.nextUrl.pathname.startsWith('/api/')) {
       return await applyRateLimit(request, response);
     }
     
     return response;
   }

   // Security headers unchanged

   async function applyRateLimit(request: NextRequest, response: NextResponse): Promise<NextResponse> {
     // Get unique identifier (IP or API key)
     const forwardedFor = request.headers.get('X-Forwarded-For');
     const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
     const clientId = request.headers.get('X-API-Key') || clientIp;
     
     const now = Date.now();
     const key = `ratelimit:${clientId}`;
     
     // Get current rate limit data from Redis
     const data = await redis.get(key);
     let rateData = data ? JSON.parse(data) : { count: 0, timestamp: now };
     
     // Reset if outside window
     if (now - rateData.timestamp > RATE_LIMIT_WINDOW) {
       rateData = { count: 0, timestamp: now };
     }
     
     // Increment and store
     rateData.count += 1;
     await redis.set(key, JSON.stringify(rateData), 'EX', 120); // 2 minute expiry
     
     // Add headers
     response.headers.set('X-RateLimit-Limit', MAX_REQUESTS.toString());
     response.headers.set('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - rateData.count).toString());
     response.headers.set('X-RateLimit-Reset', (rateData.timestamp + RATE_LIMIT_WINDOW).toString());
     
     // Check if limit exceeded
     if (rateData.count > MAX_REQUESTS) {
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
             'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit') || '',
             'X-RateLimit-Remaining': '0',
             'X-RateLimit-Reset': response.headers.get('X-RateLimit-Reset') || ''
           }
         }
       );
     }
     
     return response;
   }
   ```

3. **Endpoint-specific rate limits:**
   
   Add these to your .env file:
   ```
   # Rate limits per minute
   RATE_LIMIT_SEARCH=60
   RATE_LIMIT_EMBEDDING=30
   RATE_LIMIT_STREAMING=20
   ```

   Then update middleware to apply different limits to different endpoints:
   ```typescript
   // In middleware.ts
   function getMaxRequestsForEndpoint(pathname: string): number {
     if (pathname.includes('/api/search')) {
       return parseInt(process.env.RATE_LIMIT_SEARCH || '60', 10);
     } else if (pathname.includes('/api/embeddings')) {
       return parseInt(process.env.RATE_LIMIT_EMBEDDING || '30', 10);
     } else if (pathname.includes('/api/streaming-search')) {
       return parseInt(process.env.RATE_LIMIT_STREAMING || '20', 10);
     }
     return parseInt(process.env.API_RATE_LIMIT || '60', 10);
   }
   ```

## 2. Input Validation

### Priority: Critical
### Timeline: Immediate (within 24 hours of deployment)

1. **Install Zod validation library:**
   ```bash
   npm install zod
   ```

2. **Create API schema validators:**
   ```typescript
   // lib/validators/schemas.ts
   import { z } from 'zod';

   export const searchSchema = z.object({
     query: z.string().min(1).max(500),
     maxResults: z.number().int().positive().optional().default(50),
     includeAnalysis: z.boolean().optional().default(true),
     similarityThreshold: z.number().min(0).max(1).optional().default(0.6),
     subreddits: z.array(z.string()).optional(),
     useMetadataBoost: z.boolean().optional().default(true),
     useFallback: z.boolean().optional().default(true),
     skipCache: z.boolean().optional().default(false),
     defaultLocation: z.string().optional(),
     vectorWeight: z.number().min(0).max(1).optional().default(0.7),
     textWeight: z.number().min(0).max(1).optional().default(0.3),
     efSearch: z.number().int().positive().optional().default(300)
   });

   export const embeddingSchema = z.object({
     query: z.string().min(1).max(500)
   });
   ```

3. **Implement validation in API routes:**
   ```typescript
   // app/api/search/route.ts
   import { searchSchema } from '@/lib/validators/schemas';
   
   export async function POST(request: NextRequest) {
     try {
       // Parse request body
       const body = await request.json().catch(() => ({}));
       
       // Validate with Zod
       const validationResult = searchSchema.safeParse(body);
       if (!validationResult.success) {
         return errorResponse(`Invalid request: ${validationResult.error.message}`, 400);
       }
       
       // Use validated data (with proper types)
       const options: SearchOptions = validationResult.data;
       
       // Continue with search operation...
     } catch (error) {
       // Error handling...
     }
   }
   ```

4. **Create middleware validation helper:**
   ```typescript
   // lib/utils/validate-request.ts
   import { NextRequest, NextResponse } from 'next/server';
   import { z } from 'zod';

   export async function validateRequest<T>(
     req: NextRequest, 
     schema: z.ZodSchema<T>
   ): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
     try {
       const body = await req.json().catch(() => ({}));
       const result = schema.safeParse(body);
       
       if (!result.success) {
         const response = NextResponse.json(
           { error: `Validation error: ${result.error.message}` },
           { status: 400 }
         );
         return { success: false, response };
       }
       
       return { success: true, data: result.data };
     } catch (error) {
       const response = NextResponse.json(
         { error: 'Invalid request format' },
         { status: 400 }
       );
       return { success: false, response };
     }
   }
   ```

## 3. API Key for Sensitive Endpoints

### Priority: High
### Timeline: First week

Even without user authentication, you can use API keys for your backend services:

1. **Generate a secure API key:**
   ```bash
   # Run this in your terminal to generate a key
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Store the key in environment variables:**
   ```
   # .env.local
   INTERNAL_API_KEY=your_generated_key_here
   ```

3. **Add middleware for API key validation:**
   ```typescript
   // lib/utils/api-key-middleware.ts
   import { NextRequest, NextResponse } from 'next/server';

   export function apiKeyMiddleware(req: NextRequest) {
     // Skip for non-sensitive endpoints
     if (!req.nextUrl.pathname.startsWith('/api/embeddings') && 
         !req.nextUrl.pathname.startsWith('/api/debug')) {
       return NextResponse.next();
     }
     
     const apiKey = req.headers.get('X-API-Key');
     const expectedKey = process.env.INTERNAL_API_KEY;
     
     if (!apiKey || apiKey !== expectedKey) {
       return NextResponse.json(
         { error: 'Unauthorized: Invalid API key' },
         { status: 401 }
       );
     }
     
     return NextResponse.next();
   }
   ```

4. **Update your middleware.ts to include API key checks:**
   ```typescript
   // In middleware.ts
   export function middleware(request: NextRequest) {
     // First check API key for sensitive endpoints
     const apiKeyCheck = apiKeyMiddleware(request);
     if (apiKeyCheck.status === 401) {
       return apiKeyCheck;
     }
     
     // Continue with rest of middleware...
   }
   ```

## 4. CORS Configuration

### Priority: High
### Timeline: First week

1. **Update OPTIONS handlers with more restrictive CORS:**
   ```typescript
   // app/api/search/route.ts (and similar for other endpoints)
   export async function OPTIONS() {
     const allowedOrigins = process.env.NODE_ENV === 'production'
       ? ['https://localguru.com', 'https://app.localguru.com']
       : ['http://localhost:3000'];
       
     const origin = req.headers.get('origin');
     const allowOrigin = allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0];
     
     return new Response(null, {
       status: 204,
       headers: {
         'Access-Control-Allow-Origin': allowOrigin,
         'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
         'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
         'Access-Control-Max-Age': '86400' // 24 hours
       }
     });
   }
   ```

2. **Add CORS checking middleware:**
   ```typescript
   // lib/utils/cors-middleware.ts
   export function corsMiddleware(req: NextRequest) {
     if (!req.nextUrl.pathname.startsWith('/api/')) {
       return NextResponse.next();
     }
     
     const allowedOrigins = process.env.NODE_ENV === 'production'
       ? ['https://localguru.com', 'https://app.localguru.com']
       : ['http://localhost:3000'];
       
     const origin = req.headers.get('origin');
     
     // Check if origin is allowed
     if (origin && !allowedOrigins.includes(origin)) {
       return NextResponse.json(
         { error: 'CORS error: Origin not allowed' },
         { status: 403 }
       );
     }
     
     return NextResponse.next();
   }
   ```

## 5. Request Size Limiting

### Priority: Medium
### Timeline: First week

1. **Add content length checking to middleware:**
   ```typescript
   // In middleware.ts
   export function middleware(request: NextRequest) {
     // Check content length
     const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
     const MAX_CONTENT_LENGTH = 1024 * 1024; // 1MB
     
     if (contentLength > MAX_CONTENT_LENGTH) {
       return NextResponse.json(
         { error: 'Payload too large' },
         { status: 413 }
       );
     }
     
     // Continue with rest of middleware...
   }
   ```

2. **Set different limits for different endpoints:**
   ```typescript
   // In middleware.ts
   function getMaxContentSizeForEndpoint(pathname: string): number {
     if (pathname.includes('/api/streaming-search')) {
       return 10 * 1024; // 10KB for streaming search
     } else if (pathname.includes('/api/search')) {
       return 20 * 1024; // 20KB for regular search
     }
     return 1024 * 1024; // 1MB default
   }
   
   // In the middleware function
   const MAX_CONTENT_LENGTH = getMaxContentSizeForEndpoint(request.nextUrl.pathname);
   ```

## Implementation Plan

### Day 1
- [ ] Update middleware.ts with basic rate limiting (in-memory if Redis isn't available yet)
- [ ] Add Zod validation to search and embeddings API endpoints
- [ ] Implement basic API key validation for sensitive endpoints

### Week 1
- [ ] Set up Redis for distributed rate limiting
- [ ] Configure CORS with proper origin restrictions
- [ ] Add request size limiting
- [ ] Create test scripts to verify security measures

### Week 2
- [ ] Implement logs monitoring for security events
- [ ] Set up alerts for suspicious activity
- [ ] Create documentation for security measures 