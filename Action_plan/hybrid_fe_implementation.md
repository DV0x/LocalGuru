
# Detailed Implementation Plan for Hybrid Search Migration

## 1. Database Migrations

### Step 1.1: Create a timed version of hybrid_search

Create a new migration file in `supabase/migrations/` named `20240425000000_timed_hybrid_search.sql`:

```sql
-- Migration to implement a timed version of the hybrid search function
-- This adds a statement timeout to prevent long-running queries

-- Create a wrapper function with increased statement timeout
CREATE OR REPLACE FUNCTION public.timed_hybrid_search(
  p_query text,                                   -- The user's raw search query
  p_query_embedding vector(512),                  -- 512-dim embedding vector of the query
  p_query_intent text DEFAULT 'general',          -- Intent from query analysis
  p_query_topics text[] DEFAULT '{}',             -- Topics from query analysis
  p_query_locations text[] DEFAULT '{}',          -- Locations from query analysis
  p_max_results integer DEFAULT 20,               -- Maximum results to return
  p_match_threshold double precision DEFAULT 0.6, -- Min similarity threshold
  p_vector_weight double precision DEFAULT 0.7,   -- Weight for vector score
  p_text_weight double precision DEFAULT 0.3,     -- Weight for text score
  p_ef_search integer DEFAULT 100                 -- HNSW ef_search parameter
)
RETURNS TABLE(
  id text,                              -- Content ID
  title text,                           -- Title (null for comments)
  content text,                         -- Main content
  content_snippet text,                 -- Snippet for display
  url text,                             -- URL if available
  subreddit text,                       -- Subreddit
  author text,                          -- Author
  content_type text,                    -- 'post' or 'comment'
  created_at timestamp with time zone,  -- Creation date
  similarity double precision,          -- Combined similarity score
  match_type text,                      -- Type of match (title/context_enhanced)
  metadata jsonb                        -- Additional metadata
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set a higher statement timeout just for this function call
  SET LOCAL statement_timeout = '30s';
  
  -- Enable parallel query execution
  SET LOCAL max_parallel_workers_per_gather = 4;
  
  -- Call the hybrid_search function
  RETURN QUERY
  SELECT * FROM public.hybrid_search(
    p_query, 
    p_query_embedding,
    p_query_intent,
    p_query_topics,
    p_query_locations,
    p_max_results,
    p_match_threshold,
    p_vector_weight,
    p_text_weight,
    p_ef_search
  );
END;
$$;

-- Add comments to document the function
COMMENT ON FUNCTION public.timed_hybrid_search IS 'Wrapper for hybrid_search with a 30-second statement timeout to prevent long-running queries. Uses parallel query execution for better performance.';

-- Grant execution permissions to roles
GRANT EXECUTE ON FUNCTION public.timed_hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.timed_hybrid_search TO service_role;
```

### Step 1.2: Remove the old multi_strategy_search functions

Create a new migration file in `supabase/migrations/` named `20240425010000_remove_multi_strategy_search.sql`:

```sql
-- Migration to remove the multi_strategy_search functions
-- as they are being replaced by hybrid_search

-- Drop the timed version first (if it exists)
DROP FUNCTION IF EXISTS public.timed_multi_strategy_search(
  text, vector, text, text[], text[], integer, double precision
);

-- Drop the original function
DROP FUNCTION IF EXISTS public.multi_strategy_search(
  text, vector, text, text[], text[], integer, double precision
);

-- Add a comment to document the migration
COMMENT ON SCHEMA public IS 'Removed multi_strategy_search functions as part of migration to hybrid_search.';
```

## 2. Update Embedding Service

### Step 2.1: Update query-embeddings Edge Function

Update the Edge Function for generating embeddings. If it's a Supabase Edge Function, you'll need to locate it in the Supabase project directory:

```typescript
// File: supabase/functions/query-embeddings/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1';

// Configure OpenAI
const configuration = new Configuration({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});
const openai = new OpenAIApi(configuration);

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { query, model = 'text-embedding-3-large', dimensions = 512 } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first
    const { data: cacheData, error: cacheError } = await supabaseClient
      .from('embeddings_cache')
      .select('embedding, created_at')
      .eq('query', query.toLowerCase())
      .eq('model', model)
      .eq('dimensions', dimensions)
      .maybeSingle();

    if (!cacheError && cacheData) {
      console.log('Cache hit for query:', query);
      return new Response(
        JSON.stringify({
          query,
          embedding: cacheData.embedding,
          cached: true,
          created_at: cacheData.created_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new embedding
    console.log('Generating new embedding for query:', query);
    const response = await openai.createEmbedding({
      model,
      input: query,
      dimensions,  // Specify 512 dimensions
    });

    const embedding = response.data.data[0].embedding;

    // Store in cache
    const { error: insertError } = await supabaseClient
      .from('embeddings_cache')
      .insert({
        query: query.toLowerCase(),
        embedding,
        model,
        dimensions
      });

    if (insertError) {
      console.error('Error caching embedding:', insertError);
    }

    // Return the embedding
    return new Response(
      JSON.stringify({ query, embedding, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate embedding', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 2.2: Update the embeddings_cache table schema

Create a migration to update the embeddings_cache table to support the dimension field:

```sql
-- File: supabase/migrations/20240425020000_update_embeddings_cache.sql

-- Add dimensions column to embeddings_cache table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'embeddings_cache'
      AND column_name = 'dimensions'
  ) THEN
    ALTER TABLE public.embeddings_cache
    ADD COLUMN dimensions integer DEFAULT 512;
  END IF;
  
  -- Add model column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'embeddings_cache'
      AND column_name = 'model'
  ) THEN
    ALTER TABLE public.embeddings_cache
    ADD COLUMN model text DEFAULT 'text-embedding-3-large';
  END IF;
END
$$;

-- Update existing records to specify dimensions and model
UPDATE public.embeddings_cache
SET dimensions = 1536, model = 'text-embedding-3-small'
WHERE dimensions IS NULL OR model IS NULL;

-- Update the primary key to include model and dimensions
ALTER TABLE public.embeddings_cache 
DROP CONSTRAINT IF EXISTS embeddings_cache_pkey;

ALTER TABLE public.embeddings_cache
ADD CONSTRAINT embeddings_cache_pkey 
PRIMARY KEY (query, model, dimensions);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_embeddings_cache_query_model_dimensions
ON public.embeddings_cache(query, model, dimensions);
```

## 3. Frontend Modifications

### Step 3.1: Update the types.ts files

Update the `app/lib/supabase/types.ts` file:

```typescript
// File: app/lib/supabase/types.ts

/**
 * Result structure from the query-embeddings edge function
 */
export interface EmbeddingResult {
  query: string;
  embedding: number[]; // 512-dimensional vector
  cached?: boolean;
  created_at?: string;
  model?: string;
  dimensions?: number;
}

// Update other interfaces as needed, but the SearchResult interface
// should remain compatible with hybrid_search output
```

Update the `app/lib/search/types.ts` file:

```typescript
// File: app/lib/search/types.ts

/**
 * Options for performing a search
 */
export interface SearchOptions {
  query: string;
  maxResults?: number;
  includeAnalysis?: boolean;
  similarityThreshold?: number;
  subreddits?: string[];
  vectorWeight?: number;   // New parameter
  textWeight?: number;     // New parameter
  efSearch?: number;       // New parameter
  skipCache?: boolean;
}

// Other interfaces remain the same
```

### Step 3.2: Update the executeSearch function in query-processor.ts

Modify the `app/lib/search/query-processor.ts` file:

```typescript
// File: app/lib/search/query-processor.ts

/**
 * Executes the hybrid search with the given parameters
 * @param query The original search query
 * @param queryEmbedding The embedding vector for the query
 * @param queryIntent The detected intent of the query
 * @param queryTopics The detected topics in the query
 * @param queryLocations The detected locations in the query
 * @param maxResults Maximum number of results to return
 * @param matchThreshold Similarity threshold for matching
 * @param vectorWeight Weight for vector similarity score (default 0.7)
 * @param textWeight Weight for text search score (default 0.3)
 * @param efSearch HNSW index search parameter (default 100)
 * @returns Array of search results
 */
export async function executeSearch(
  query: string,
  queryEmbedding: number[] | null,
  queryIntent: string,
  queryTopics: string[] | null,
  queryLocations: string[] | null,
  maxResults: number = 20,
  matchThreshold: number = 0.6,
  vectorWeight: number = 0.7,
  textWeight: number = 0.3,
  efSearch: number = 100
): Promise<SearchResult[]> {
  try {
    console.log('Executing hybrid search with parameters:', {
      query,
      embeddingLength: queryEmbedding?.length || 0,
      intent: queryIntent,
      topics: queryTopics,
      locations: queryLocations,
      maxResults,
      matchThreshold,
      vectorWeight,
      textWeight,
      efSearch
    });
    
    // Call the timed hybrid search function
    const { data, error } = await supabaseAdmin.rpc('timed_hybrid_search', {
      p_query: query,
      p_query_embedding: queryEmbedding,
      p_query_intent: queryIntent,
      p_query_topics: queryTopics || [],
      p_query_locations: queryLocations || [],
      p_max_results: maxResults,
      p_match_threshold: matchThreshold,
      p_vector_weight: vectorWeight,
      p_text_weight: textWeight,
      p_ef_search: efSearch
    });
    
    if (error) {
      console.error('Hybrid search error:', error);
      throw new ApiError(`Search execution failed: ${error.message}`, 500);
    }
    
    console.log(`Hybrid search returned ${data?.length || 0} results`);
    return data || [];
  } catch (error) {
    console.error('Error executing search:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to execute search', 500);
  }
}
```

### Step 3.3: Update the performFullSearch function

```typescript
// File: app/lib/search/query-processor.ts (continued)

/**
 * Complete search flow that handles all steps: analysis, embeddings, and search
 * @param options Search options
 * @returns Search results and analysis
 */
export async function performFullSearch(options: SearchOptions) {
  const { 
    query, 
    maxResults = 20, 
    includeAnalysis = true,
    similarityThreshold = 0.45,
    subreddits = [],
    vectorWeight = 0.7,      // New parameter with default
    textWeight = 0.3,        // New parameter with default
    efSearch = 100,          // New parameter with default
    skipCache = false
  } = options;

  // Check cache first if not explicitly skipped
  if (!skipCache) {
    const cacheKey = createCacheKey(options);
    const cachedResult = SEARCH_CACHE.get(cacheKey);
    
    if (cachedResult) {
      console.log('Cache hit for query:', query);
      return {
        results: cachedResult.results,
        analysis: includeAnalysis ? cachedResult.analysis : undefined,
        query,
        cached: true
      };
    }
  }

  // Create a timeout promise that returns a specific error
  const timeoutError = new Error('Search timeout exceeded');
  timeoutError.name = 'TimeoutError';
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(timeoutError), 120000); // 120-second timeout
  });

  try {
    // Use Promise.race to handle potential timeouts
    // Start both analysis and embedding generation concurrently
    const analysisPromise = analyzeQuery(query);
    
    // Specify the model and dimensions in the embedding request
    const embeddingsPromise = generateEmbeddings(query);
    
    // Wait for both promises with timeout
    const analysis = await Promise.race([analysisPromise, timeoutPromise]) as QueryAnalysisResult;
    const embeddingResult = await Promise.race([embeddingsPromise, timeoutPromise]) as EmbeddingResult;
    
    // Execute search with the analysis and embeddings
    const searchResults = await Promise.race([
      executeSearch(
        query,
        embeddingResult.embedding,
        analysis.intent,
        analysis.topics,
        analysis.locations,
        maxResults,
        similarityThreshold,
        vectorWeight,
        textWeight,
        efSearch
      ),
      timeoutPromise
    ]) as SearchResult[];
    
    // Store in cache
    const cacheKey = createCacheKey(options);
    SEARCH_CACHE.set(cacheKey, {
      timestamp: Date.now(),
      results: searchResults,
      analysis
    });
    
    // Clean up cache occasionally
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      cleanupCache();
    }
    
    return {
      results: searchResults,
      analysis: includeAnalysis ? analysis : undefined,
      query,
      cached: false
    };
  } catch (error) {
    console.error('Error in search process:', error);
    
    // If the error is a timeout, try to return partial results
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.log('Search timeout occurred, attempting to return partial results');
      
      // Try to retrieve any cached results for similar queries
      const similarQueries = SEARCH_CACHE.keys();
      for (const key of similarQueries) {
        if (key.includes(query.toLowerCase().substring(0, 5))) {
          const cachedResult = SEARCH_CACHE.get(key);
          if (cachedResult) {
            console.log('Using cached results for similar query:', key);
            return {
              results: cachedResult.results,
              analysis: includeAnalysis ? cachedResult.analysis : undefined,
              query,
              cached: true,
              partial: true
            };
          }
        }
      }
      
      // If no similar cached results, return a timeout error
      throw new ApiError('Search operation timed out. Please try a more specific query.', 408);
    }
    
    // For other errors, just re-throw
    throw error;
  }
}

/**
 * Creates a cache key from search options, including new parameters
 */
function createCacheKey(options: SearchOptions): string {
  return `${options.query.toLowerCase()}_${options.maxResults || 20}_${options.similarityThreshold || 0.6}_${options.vectorWeight || 0.7}_${options.textWeight || 0.3}`;
}
```

### Step 3.4: Update the API routes if necessary

If needed, update the API route file to support the new parameters:

```typescript
// File: app/api/search/route.ts

// Update the search API endpoint to accept new parameters
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Validate query
    if (!body.query || typeof body.query !== 'string') {
      return errorResponse('Query is required and must be a string', 400);
    }
    
    // Create search options from request with new parameters
    const options: SearchOptions = {
      query: body.query,
      maxResults: body.maxResults || 20,
      includeAnalysis: body.includeAnalysis !== false, // Default to true
      similarityThreshold: body.similarityThreshold || 0.6,
      subreddits: body.subreddits,
      vectorWeight: body.vectorWeight || 0.7,    // New parameter
      textWeight: body.textWeight || 0.3,        // New parameter
      efSearch: body.efSearch || 100,            // New parameter
      skipCache: body.skipCache === true // Default to false (use cache)
    };
    
    // ... rest of the function remains the same
  }
  // ... rest of the file remains the same
}
```

## 4. Testing

### Step 4.1: Create a test script for the hybrid search

Create a test file to verify the hybrid search implementation:

```typescript
// File: tests/hybrid-search-test.ts

import { performFullSearch } from '../app/lib/search/query-processor';

// Sample queries to test
const testQueries = [
  'best restaurants in San Francisco',
  'hiking trails near Seattle',
  'JavaScript programming tips',
  'how to cook pasta',
  'electric car comparison'
];

// Test with different parameters
const testParameters = [
  { vectorWeight: 0.7, textWeight: 0.3, efSearch: 100 }, // Default
  { vectorWeight: 0.5, textWeight: 0.5, efSearch: 100 }, // Equal weighting
  { vectorWeight: 0.9, textWeight: 0.1, efSearch: 100 }, // Vector heavy
  { vectorWeight: 0.7, textWeight: 0.3, efSearch: 200 }  // Higher ef_search
];

async function runTests() {
  console.log('Running hybrid search tests...\n');
  
  for (const query of testQueries) {
    console.log(`Testing query: "${query}"`);
    
    for (const params of testParameters) {
      console.log(`  Parameters: ${JSON.stringify(params)}`);
      
      const startTime = Date.now();
      
      try {
        const result = await performFullSearch({
          query,
          maxResults: 10,
          includeAnalysis: true,
          vectorWeight: params.vectorWeight,
          textWeight: params.textWeight,
          efSearch: params.efSearch
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`  Results: ${result.results.length} found in ${duration}ms`);
        console.log(`  Sample result: "${result.results[0]?.title.substring(0, 50)}..."`);
      } catch (error) {
        console.error(`  Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    console.log('-----------------------------------\n');
  }
}

runTests().catch(console.error);
```

## 5. Logging and Monitoring

### Step 5.1: Add detailed logging

Enhance logging in key functions to monitor performance:

```typescript
// Add to executeSearch function
const startTime = Date.now();
// ... perform search
const endTime = Date.now();
console.log(`Hybrid search completed in ${endTime - startTime}ms for query "${query}" with ${data?.length || 0} results`);
```

### Step 5.2: Create monitoring dashboard (conceptual)

Consider creating a monitoring dashboard that tracks:

1. Average search time
2. Number of search results
3. Error rates
4. Cache hit rates
5. Parameter distributions

## 6. Deployment Plan

### Step 6.1: Deployment sequence

1. Deploy database migrations:
   - `20240420000000_hybrid_search_function.sql` (already prepared)
   - `20240425000000_timed_hybrid_search.sql`
   - `20240425020000_update_embeddings_cache.sql`

2. Deploy the updated embedding service

3. Deploy frontend code changes:
   - Updated type definitions
   - Updated search functions
   - API route changes

4. Run tests to verify everything works

### Step 6.2: Rollback plan

If issues occur, have a rollback plan ready:

1. Keep a backup of the multi_strategy_search function definitions
2. Be prepared to restore them if needed
3. Have a quick migration script ready to roll back changes

## Complete Implementation Checklist

- [ ] Deploy `20240420000000_hybrid_search_function.sql`
- [ ] Create and deploy `20240425000000_timed_hybrid_search.sql`
- [ ] Create and deploy `20240425020000_update_embeddings_cache.sql`
- [ ] Update the embedding service to use text-embedding-3-large with 512 dimensions
- [ ] Update type definitions in app/lib/supabase/types.ts
- [ ] Update type definitions in app/lib/search/types.ts
- [ ] Rewrite executeSearch function to use hybrid_search
- [ ] Update performFullSearch to pass new parameters
- [ ] Update API routes to accept new parameters
- [ ] Create and run tests to verify the implementation
- [ ] Monitor performance after deployment
- [ ] Update documentation for developers and API users

This detailed plan provides a comprehensive approach to migrating from multi_strategy_search to hybrid_search while maintaining the existing file structure and only changing what's necessary to support the new search functionality.
