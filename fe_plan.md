# Implementation Plan: Query Flow Integration with Next.js App Router

## Overview
We'll implement a secure query flow that follows the complete search process from your backend while protecting sensitive API keys and providing a smooth user experience.

## Architecture Plan

### 1. Route Structure
```
app/
├── api/
│   ├── search/
│   │   └── route.ts              # Main search orchestration
│   ├── query-analysis/  
│   │   └── route.ts              # Query analysis proxy
│   ├── embeddings/
│   │   └── route.ts              # Embedding generation proxy
│   └── feedback/
│       └── route.ts              # User feedback handling
├── lib/
│   ├── supabase/
│   │   ├── client-server.ts      # Server-side Supabase client
│   │   └── types.ts              # Supabase-related type definitions
│   ├── search/
│   │   ├── query-processor.ts    # Query processing utilities
│   │   ├── result-formatter.ts   # Result formatting utilities
│   │   └── types.ts              # Search-related type definitions
│   └── utils/
│       ├── api-response.ts       # Standardized API response handling
│       └── error-handling.ts     # Error handling utilities
├── page.tsx                      # Main application page (existing)
├── components/                   # UI components (existing)
├── middleware.ts                 # Add rate limiting and security headers
└── .env                          # Server-side environment variables
```

Detailed Implementation Plan for Query Flow Integration

## Phase 1: Create Directory Structure & Type Definitions

### Step 1: Set up directory structure
```bash
mkdir -p app/api/search app/api/query-analysis app/api/embeddings app/api/feedback
mkdir -p app/lib/supabase app/lib/search app/lib/utils
```

### Step 2: Create type definitions

**`app/lib/supabase/types.ts`**
```typescript
// Supabase-specific types
export interface QueryAnalysisResult {
  query: string;
  entities: {
    [key: string]: string[];
  };
  topics: string[];
  locations: string[];
  intent: 'recommendation' | 'information' | 'comparison' | 'experience' | 'local_events' | 'how_to' | 'discovery' | 'general';
  enhancedQueries?: string[];
}

export interface EmbeddingResult {
  query: string;
  embedding: number[];
  cached?: boolean;
}

// Match the structure from enhanced_intent_multi_strategy_search.sql
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  content_snippet: string;
  url: string;
  subreddit: string;
  author: string;
  content_type: string;
  created_at: string;
  similarity: number;
  match_type: string;
  metadata: Record<string, any>;
}
```

**`app/lib/search/types.ts`**
```typescript
import { SearchResult, QueryAnalysisResult } from '../supabase/types';

// Frontend-friendly result type (matches TravelRecommendation)
export interface FormattedSearchResult {
  id: string;
  title: string;
  location: string;
  description: string;
  tags: string[];
  source: string;
  sourceUrl: string;
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
  includeAnalysis?: boolean;
  similarityThreshold?: number;
}

export interface SearchResponse {
  results: FormattedSearchResult[];
  analysis?: QueryAnalysisResult;
  query: string;
}
```

## Phase 2: Implement Core Services & Utilities

### Step 1: Supabase server client

**`app/lib/supabase/client-server.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

// Only used server-side
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase server-side credentials');
}

// Create a Supabase client with the service role key
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### Step 2: API response utilities

**`app/lib/utils/api-response.ts`**
```typescript
export function successResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

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
```

**`app/lib/utils/error-handling.ts`**
```typescript
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error instanceof ApiError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({ error: 'An unexpected error occurred' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

### Step 3: Search processing utilities

**`app/lib/search/query-processor.ts`**
```typescript
import { supabaseAdmin } from '../supabase/client-server';
import { QueryAnalysisResult, EmbeddingResult } from '../supabase/types';
import { ApiError } from '../utils/error-handling';

export async function analyzeQuery(query: string): Promise<QueryAnalysisResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('query-analysis', {
      body: { query }
    });
    
    if (error) throw new ApiError(`Query analysis failed: ${error.message}`, 500);
    if (!data) throw new ApiError('No analysis data returned', 500);
    
    return data as QueryAnalysisResult;
  } catch (error) {
    console.error('Error in query analysis:', error);
    throw error instanceof ApiError ? error : new ApiError('Failed to analyze query', 500);
  }
}

export async function generateEmbeddings(query: string): Promise<EmbeddingResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('query-embeddings', {
      body: { query }
    });
    
    if (error) throw new ApiError(`Embedding generation failed: ${error.message}`, 500);
    if (!data || !data.embedding) throw new ApiError('No embedding data returned', 500);
    
    return data as EmbeddingResult;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error instanceof ApiError ? error : new ApiError('Failed to generate embeddings', 500);
  }
}

export async function executeSearch(
  query: string,
  queryEmbedding: number[],
  queryIntent: string,
  queryTopics: string[],
  queryLocations: string[],
  maxResults: number = 20,
  matchThreshold: number = 0.6
) {
  try {
    const { data, error } = await supabaseAdmin.rpc('multi_strategy_search', {
      p_query: query,
      p_query_embedding: queryEmbedding,
      p_query_intent: queryIntent,
      p_query_topics: queryTopics,
      p_query_locations: queryLocations,
      p_max_results: maxResults,
      p_match_threshold: matchThreshold
    });
    
    if (error) throw new ApiError(`Search execution failed: ${error.message}`, 500);
    
    return data || [];
  } catch (error) {
    console.error('Error executing search:', error);
    throw error instanceof ApiError ? error : new ApiError('Failed to execute search', 500);
  }
}
```

**`app/lib/search/result-formatter.ts`**
```typescript
import { SearchResult } from '../supabase/types';
import { FormattedSearchResult } from './types';

export function formatSearchResults(results: SearchResult[]): FormattedSearchResult[] {
  return results.map(result => ({
    id: result.id,
    title: result.title || (result.content_type === 'post' ? 'Untitled Post' : 'Comment'),
    location: result.subreddit ? `r/${result.subreddit}` : 'Reddit',
    description: result.content_snippet || result.content.substring(0, 300),
    tags: [
      result.content_type,
      result.author,
      ...(result.subreddit ? [`r/${result.subreddit}`] : []),
      ...(result.metadata?.topics || []).slice(0, 3)
    ],
    source: result.content_type === 'post' ? 'Reddit Post' : 'Reddit Comment',
    sourceUrl: result.url || `https://reddit.com${result.permalink || ''}`
  }));
}
```

## Phase 3: Implement API Routes

### Step 1: Search API route

**`app/api/search/route.ts`**
```typescript
import { NextRequest } from 'next/server';
import { analyzeQuery, generateEmbeddings, executeSearch } from '@/app/lib/search/query-processor';
import { formatSearchResults } from '@/app/lib/search/result-formatter';
import { successResponse, errorResponse } from '@/app/lib/utils/api-response';
import { handleApiError } from '@/app/lib/utils/error-handling';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { query, maxResults = 20, includeAnalysis = true } = body;
    
    if (!query || typeof query !== 'string') {
      return errorResponse('Query is required and must be a string', 400);
    }
    
    // Step 1: Analyze the query
    const analysis = await analyzeQuery(query);
    
    // Step 2: Generate embeddings
    const embeddingResult = await generateEmbeddings(query);
    
    // Step 3: Execute search with the analysis and embeddings
    const searchResults = await executeSearch(
      query,
      embeddingResult.embedding,
      analysis.intent,
      analysis.topics,
      analysis.locations,
      maxResults,
      0.6 // Default threshold
    );
    
    // Step 4: Format results for the frontend
    const formattedResults = formatSearchResults(searchResults);
    
    // Return the results
    return successResponse({
      results: formattedResults,
      query,
      ...(includeAnalysis ? { analysis } : {})
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Step 2: Query Analysis API route

**`app/api/query-analysis/route.ts`**
```typescript
import { NextRequest } from 'next/server';
import { analyzeQuery } from '@/app/lib/search/query-processor';
import { successResponse } from '@/app/lib/utils/api-response';
import { handleApiError } from '@/app/lib/utils/error-handling';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const analysis = await analyzeQuery(query);
    return successResponse({ analysis });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Step 3: Embeddings API route

**`app/api/embeddings/route.ts`**
```typescript
import { NextRequest } from 'next/server';
import { generateEmbeddings } from '@/app/lib/search/query-processor';
import { successResponse } from '@/app/lib/utils/api-response';
import { handleApiError } from '@/app/lib/utils/error-handling';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await generateEmbeddings(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Step 4: Feedback API route

**`app/api/feedback/route.ts`**
```typescript
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase/client-server';
import { successResponse } from '@/app/lib/utils/api-response';
import { handleApiError } from '@/app/lib/utils/error-handling';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, query, is_helpful, feedback_source = 'search_results' } = body;
    
    if (!content_id || !query) {
      return new Response(
        JSON.stringify({ error: 'Content ID and query are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Store feedback in Supabase
    const { error } = await supabaseAdmin.functions.invoke('feedback', {
      body: {
        content_id,
        query,
        is_helpful,
        feedback_source
      }
    });
    
    if (error) {
      throw new Error(`Feedback submission failed: ${error.message}`);
    }
    
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Phase 4: Set up Security with Middleware

**`app/middleware.ts`**
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// For API rate limiting
const API_CACHE = new Map<string, { count: number, timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = parseInt(process.env.API_RATE_LIMIT || '60', 10);

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Only rate limit API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || 'unknown';
    const now = Date.now();
    
    // Get or initialize user's rate limit data
    const rateData = API_CACHE.get(ip) || { count: 0, timestamp: now };
    
    // Reset if outside the window
    if (now - rateData.timestamp > RATE_LIMIT_WINDOW) {
      rateData.count = 0;
      rateData.timestamp = now;
    }
    
    // Increment request count
    rateData.count += 1;
    API_CACHE.set(ip, rateData);
    
    // Check if rate limit exceeded
    if (rateData.count > MAX_REQUESTS) {
      return new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', MAX_REQUESTS.toString());
    response.headers.set('X-RateLimit-Remaining', (MAX_REQUESTS - rateData.count).toString());
    response.headers.set('X-RateLimit-Reset', (rateData.timestamp + RATE_LIMIT_WINDOW).toString());
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all API routes but not API documentation:
     * /api/:path*
     */
    '/api/:path*',
  ],
};
```

## Phase 5: Update Frontend to Use New API Routes

**Update in `app/page.tsx`**
```typescript
// Replace the existing handleSearch function with:

const handleSearch = async (searchQuery: string) => {
  setQuery(searchQuery);
  setIsLoading(true);
  setError(undefined);

  try {
    // Call our new API route instead of Supabase directly
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        maxResults: 10
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Error: ${response.status}`);
    }

    const data = await response.json();
    
    // The results are already formatted in our API, so we can use them directly
    setResults(data.results);
  } catch (err) {
    console.error("Search error:", err);
    setError(err instanceof Error ? err.message : "An unexpected error occurred");
    setResults([]);
  } finally {
    setIsLoading(false);
  }
};

// Also update the handleFeedback function

const handleFeedback = async (id: string, isPositive: boolean) => {
  try {
    // Use our new API route
    await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content_id: id,
        query: query,
        is_helpful: isPositive,
        feedback_source: 'search_results'
      })
    });
    
    console.log(`Feedback for recommendation ${id}: ${isPositive ? 'positive' : 'negative'}`);
  } catch (error) {
    console.error("Error sending feedback:", error);
  }
};
```

## Phase 6: Add Environment Variables

**`.env` file (server-side only)**
```
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security Configuration
API_RATE_LIMIT=60
```

This implementation ensures your query flow is secure, maintainable, and follows best practices for Next.js applications. The router will now handle your search process through server-side API routes, keeping your Supabase credentials secure and adding protection against abuse.
