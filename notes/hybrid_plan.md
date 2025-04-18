
# Detailed Implementation Plan for Hybrid Search

## Phase 1: Database Function Implementation

### Step 1: Create the Hybrid Search Function
```sql
CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_query text,                                   -- The user's raw search query
  p_query_embedding vector,                       -- Embedding vector of the query
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
DECLARE
  v_title_boost float := 1.5;           -- Default boost for title representations
  v_context_boost float := 1.2;         -- Default boost for context_enhanced representations
  search_query tsquery;                 -- Text search query
BEGIN
  -- Set boost factors based on query intent
  CASE p_query_intent
    WHEN 'recommendation' THEN v_title_boost := 1.8; v_context_boost := 1.2;
    WHEN 'information' THEN v_title_boost := 1.6; v_context_boost := 1.3;
    WHEN 'comparison' THEN v_title_boost := 1.7; v_context_boost := 1.3;
    WHEN 'experience' THEN v_title_boost := 1.4; v_context_boost := 1.5;
    WHEN 'local_events' THEN v_title_boost := 1.6; v_context_boost := 1.2;
    WHEN 'how_to' THEN v_title_boost := 1.5; v_context_boost := 1.6;
    WHEN 'discovery' THEN v_title_boost := 1.8; v_context_boost := 1.1;
    ELSE v_title_boost := 1.5; v_context_boost := 1.2;
  END CASE;

  -- Create text search query from input
  search_query := websearch_to_tsquery('english', p_query);
  
  -- Temporarily set the ef_search parameter for this session
  SET LOCAL hnsw.ef_search = p_ef_search;
  
  -- Hybrid search combining text search and vector search
  RETURN QUERY
  WITH text_search AS (
    -- Fast pre-filtering using PostgreSQL full-text search on posts
    SELECT 
      p.id AS parent_id,
      'post' AS content_type,
      p.title,
      p.content,
      p.url,
      p.subreddit,
      p.author_id AS author,
      p.created_at,
      ts_rank_cd(p.search_vector, search_query) AS text_score
    FROM 
      public.reddit_posts p
    WHERE 
      p.search_vector @@ search_query
      AND (
        cardinality(p_query_locations) = 0 
        OR p.subreddit ILIKE ANY(p_query_locations)
      )
      AND (
        p_query_intent != 'how_to'
        OR p.title ILIKE ANY(ARRAY['how to%', '%guide%', '%tutorial%', '%steps%', '%instructions%'])
      )
    LIMIT 500  -- Limit results for performance
    
    UNION ALL
    
    -- Fast pre-filtering using PostgreSQL full-text search on comments
    SELECT 
      c.id AS parent_id,
      'comment' AS content_type,
      NULL AS title,  -- Comments don't have titles
      c.content,
      NULL AS url,
      NULL AS subreddit,
      c.author_id AS author,
      c.created_at,
      ts_rank_cd(c.search_vector, search_query) AS text_score
    FROM 
      public.reddit_comments c
    WHERE 
      c.search_vector @@ search_query
    LIMIT 500  -- Limit results for performance
  ),
  
  -- Vector search on pre-filtered results
  vector_search AS (
    SELECT 
      ts.parent_id,
      ts.content_type,
      ts.title,
      ts.content,
      ts.url,
      ts.subreddit,
      ts.author,
      ts.created_at,
      CASE
        WHEN cr.representation_type = 'title' THEN 
          (1.0 - (cr.embedding <=> p_query_embedding)) * v_title_boost
        WHEN cr.representation_type = 'context_enhanced' THEN 
          (1.0 - (cr.embedding <=> p_query_embedding)) * v_context_boost
        ELSE
          (1.0 - (cr.embedding <=> p_query_embedding))
      END AS vector_score,
      ts.text_score,
      cr.representation_type AS match_type,
      cr.metadata
    FROM 
      text_search ts
    JOIN 
      public.content_representations cr 
      ON ts.parent_id = cr.parent_id AND ts.content_type = cr.content_type
    WHERE 
      cr.representation_type IN ('title', 'context_enhanced')
      AND cr.embedding IS NOT NULL
      AND (1.0 - (cr.embedding <=> p_query_embedding)) > p_match_threshold * 0.7
      AND (
        cardinality(p_query_topics) = 0 
        OR cr.metadata->'topics' ?| p_query_topics
      )
  ),
  
  -- Combine and score results
  combined_scores AS (
    SELECT
      parent_id,
      content_type,
      title,
      content,
      url, 
      subreddit,
      author,
      created_at,
      vector_score,
      text_score,
      (vector_score * p_vector_weight + text_score * p_text_weight) AS combined_score,
      match_type,
      metadata
    FROM
      vector_search
  ),
  
  -- Deduplicate results (in case of multiple representation matches)
  deduplicated AS (
    SELECT DISTINCT ON (parent_id)
      parent_id,
      content_type,
      title,
      content,
      -- Create a snippet of the content for preview
      CASE 
        WHEN length(content) > 300 THEN substring(content, 1, 300) || '...'
        ELSE content
      END AS content_snippet,
      url,
      subreddit,
      author,
      created_at,
      combined_score AS final_score,
      match_type,
      metadata
    FROM
      combined_scores
    ORDER BY
      parent_id, final_score DESC
  )
  
  -- Return final results
  SELECT 
    parent_id AS id,
    title,
    content,
    content_snippet,
    url,
    subreddit,
    author,
    content_type,
    created_at,
    final_score AS similarity,
    match_type,
    metadata
  FROM 
    deduplicated
  ORDER BY 
    similarity DESC
  LIMIT p_max_results;
  
  -- Reset the HNSW parameter
  RESET hnsw.ef_search;
END;
$$;
```

### Step 2: Create Performance Testing Function
```sql
CREATE OR REPLACE FUNCTION test_hybrid_search_performance(
  p_query text,
  p_embedding vector
)
RETURNS TABLE(
  test_name text,
  duration_ms double precision,
  result_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  result_count integer;
BEGIN
  -- Test 1: Text search only
  start_time := clock_timestamp();
  SELECT COUNT(*) INTO result_count
  FROM reddit_posts
  WHERE search_vector @@ websearch_to_tsquery('english', p_query)
  LIMIT 100;
  end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'text_only_posts' AS test_name, 
    extract(milliseconds from end_time - start_time) AS duration_ms,
    result_count;
  
  -- Test 2: Vector search only 
  start_time := clock_timestamp();
  SELECT COUNT(*) INTO result_count
  FROM content_representations
  WHERE 
    representation_type = 'context_enhanced' AND
    (1.0 - (embedding <=> p_embedding)) > 0.6
  LIMIT 100;
  end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'vector_only' AS test_name, 
    extract(milliseconds from end_time - start_time) AS duration_ms,
    result_count;
  
  -- Test 3: Full hybrid search
  start_time := clock_timestamp();
  SELECT COUNT(*) INTO result_count
  FROM hybrid_search(p_query, p_embedding, 'general', '{}', '{}', 100, 0.6, 0.7, 0.3, 40);
  end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'hybrid_search' AS test_name, 
    extract(milliseconds from end_time - start_time) AS duration_ms,
    result_count;
END;
$$;
```

### Step 3: Create Search Timeout Handling Function
```sql
CREATE OR REPLACE FUNCTION hybrid_search_with_timeout(
  p_query text,
  p_query_embedding vector,
  p_max_results integer DEFAULT 20,
  p_timeout_ms integer DEFAULT 1000
)
RETURNS TABLE(
  id text,
  title text,
  content text,
  content_snippet text,
  url text,
  subreddit text, 
  author text,
  content_type text,
  created_at timestamp with time zone,
  similarity double precision,
  match_type text,
  metadata jsonb,
  timed_out boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  elapsed_ms int;
  timed_out boolean := false;
BEGIN
  start_time := clock_timestamp();
  
  -- Set statement timeout for this transaction only
  SET LOCAL statement_timeout = p_timeout_ms;
  
  BEGIN
    -- Try full hybrid search first
    RETURN QUERY
    SELECT 
      h.id, h.title, h.content, h.content_snippet,
      h.url, h.subreddit, h.author, h.content_type,
      h.created_at, h.similarity, h.match_type, h.metadata,
      false AS timed_out
    FROM hybrid_search(
      p_query, p_query_embedding, 
      'general', '{}', '{}', 
      p_max_results, 0.6, 0.7, 0.3, 40
    ) h;
  EXCEPTION WHEN statement_timeout THEN
    timed_out := true;
    
    -- Fallback to just text search (faster)
    RETURN QUERY
    WITH text_search AS (
      SELECT 
        p.id AS id,
        p.title,
        p.content,
        CASE WHEN length(p.content) > 300 THEN 
          substring(p.content, 1, 300) || '...' 
        ELSE p.content END AS content_snippet,
        p.url,
        p.subreddit,
        p.author_id AS author,
        'post' AS content_type,
        p.created_at,
        ts_rank_cd(p.search_vector, websearch_to_tsquery('english', p_query)) AS similarity,
        'text_only' AS match_type,
        '{}'::jsonb AS metadata,
        true AS timed_out
      FROM public.reddit_posts p
      WHERE p.search_vector @@ websearch_to_tsquery('english', p_query)
      
      UNION ALL
      
      SELECT 
        c.id AS id,
        '' AS title,
        c.content,
        CASE WHEN length(c.content) > 300 THEN 
          substring(c.content, 1, 300) || '...' 
        ELSE c.content END AS content_snippet,
        '' AS url,
        '' AS subreddit,
        c.author_id AS author,
        'comment' AS content_type,
        c.created_at,
        ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query)) AS similarity,
        'text_only' AS match_type,
        '{}'::jsonb AS metadata,
        true AS timed_out
      FROM public.reddit_comments c
      WHERE c.search_vector @@ websearch_to_tsquery('english', p_query)
    )
    SELECT * FROM text_search
    ORDER BY similarity DESC
    LIMIT p_max_results;
  END;
  
  -- Reset the statement timeout
  RESET statement_timeout;
END;
$$;
```

## Phase 2: Testing & Optimization

### Step 4: Initial Performance Testing
1. Create test queries with different characteristics:
```sql
-- Create a table to store test queries
CREATE TABLE IF NOT EXISTS search_test_queries (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  embedding VECTOR NOT NULL,
  query_type TEXT NOT NULL,  -- 'general', 'specific', 'technical', etc.
  expected_content_type TEXT[] NOT NULL  -- 'post', 'comment', both
);

-- Insert test queries (after generating embeddings)
INSERT INTO search_test_queries (query_text, embedding, query_type, expected_content_type)
VALUES 
  ('restaurant recommendations in NYC', [embedding vector], 'location_specific', ARRAY['post']),
  ('how to fix javascript async bug', [embedding vector], 'technical', ARRAY['post', 'comment']),
  ('best parenting advice for toddlers', [embedding vector], 'general', ARRAY['post', 'comment']);
```

2. Run performance tests across different query types:
```sql
-- Execute performance tests across all test queries
SELECT
  q.query_text,
  q.query_type,
  p.test_name,
  p.duration_ms,
  p.result_count
FROM search_test_queries q
CROSS JOIN LATERAL test_hybrid_search_performance(q.query_text, q.embedding) p
ORDER BY q.id, p.test_name;
```

### Step 5: Query Plan Analysis
1. Analyze execution plan for typical queries:
```sql
-- For a specific test query
SELECT query_text, query_type, embedding 
FROM search_test_queries 
WHERE id = 1;

-- Then use the results to run EXPLAIN ANALYZE
EXPLAIN ANALYZE 
SELECT * FROM hybrid_search(
  'restaurant recommendations in NYC',
  [embedding vector], 
  'general', 
  '{}', 
  ARRAY['NYC', 'New York'], 
  20, 
  0.6, 
  0.7, 
  0.3, 
  100
);
```

2. Analyze and identify bottlenecks in the query plan

### Step 6: Parameter Tuning
1. Test different HNSW ef_search values to find optimal balance:
```sql
-- Create function to test different ef_search values
CREATE OR REPLACE FUNCTION test_ef_search_values(
  p_query text,
  p_embedding vector
)
RETURNS TABLE(
  ef_search integer,
  duration_ms double precision,
  result_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  result_count integer;
  ef_values integer[] := ARRAY[10, 20, 40, 80, 100, 200];
  ef_val integer;
BEGIN
  FOREACH ef_val IN ARRAY ef_values LOOP
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO result_count
    FROM hybrid_search(p_query, p_embedding, 'general', '{}', '{}', 100, 0.6, 0.7, 0.3, ef_val);
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
      ef_val AS ef_search,
      extract(milliseconds from end_time - start_time) AS duration_ms,
      result_count;
  END LOOP;
END;
$$;

-- Test with a sample query
SELECT * FROM test_ef_search_values(
  'restaurant recommendations in NYC',
  [embedding vector]
);
```

2. Test different weight combinations for vector and text:
```sql
-- Create function to test different weight combinations
CREATE OR REPLACE FUNCTION test_weight_combinations(
  p_query text,
  p_embedding vector
)
RETURNS TABLE(
  vector_weight double precision,
  text_weight double precision,
  duration_ms double precision,
  result_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  result_count integer;
  v_weights double precision[] := ARRAY[0.3, 0.5, 0.7, 0.8, 0.9];
  t_weights double precision[] := ARRAY[0.7, 0.5, 0.3, 0.2, 0.1];
  i integer;
BEGIN
  FOR i IN 1..array_length(v_weights, 1) LOOP
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO result_count
    FROM hybrid_search(
      p_query, p_embedding, 'general', '{}', '{}', 
      100, 0.6, v_weights[i], t_weights[i], 100
    );
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
      v_weights[i] AS vector_weight,
      t_weights[i] AS text_weight,
      extract(milliseconds from end_time - start_time) AS duration_ms,
      result_count;
  END LOOP;
END;
$$;

-- Test with a sample query
SELECT * FROM test_weight_combinations(
  'restaurant recommendations in NYC',
  [embedding vector]
);
```

## Phase 3: Monitoring & Logging

### Step 7: Create Search Performance Logging
```sql
-- Create search log table
CREATE TABLE IF NOT EXISTS search_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  intent TEXT,
  vector_weight DOUBLE PRECISION,
  text_weight DOUBLE PRECISION,
  ef_search INTEGER,
  duration_ms DOUBLE PRECISION,
  result_count INTEGER,
  timed_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to log search performance
CREATE OR REPLACE FUNCTION log_search_performance(
  p_query text,
  p_intent text,
  p_vector_weight double precision,
  p_text_weight double precision,
  p_ef_search integer,
  p_duration_ms double precision,
  p_result_count integer,
  p_timed_out boolean DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO search_performance_logs (
    query, intent, vector_weight, text_weight, 
    ef_search, duration_ms, result_count, timed_out
  ) VALUES (
    p_query, p_intent, p_vector_weight, p_text_weight, 
    p_ef_search, p_duration_ms, p_result_count, p_timed_out
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;
```

### Step 8: Create Performance Monitoring Views
```sql
-- Create view for search performance analysis
CREATE OR REPLACE VIEW search_performance_stats AS
WITH search_stats AS (
  SELECT 
    DATE_TRUNC('hour', created_at) AS time_bucket,
    intent,
    COUNT(*) AS total_searches,
    AVG(duration_ms) AS avg_duration_ms,
    MIN(duration_ms) AS min_duration_ms,
    MAX(duration_ms) AS max_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
    SUM(CASE WHEN timed_out THEN 1 ELSE 0 END) AS timeout_count
  FROM search_performance_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY time_bucket, intent
)
SELECT * FROM search_stats
ORDER BY time_bucket DESC, avg_duration_ms DESC;

-- Create view for slow query analysis
CREATE OR REPLACE VIEW slow_searches AS
SELECT
  query,
  intent,
  vector_weight,
  text_weight,
  ef_search,
  duration_ms,
  result_count,
  created_at
FROM search_performance_logs
WHERE 
  duration_ms > 1000 OR  -- Searches taking over 1 second
  timed_out = true
ORDER BY created_at DESC;
```

## Phase 4: Application Implementation

### Step 9: Create Backend API Endpoint
1. Create a search endpoint in Next.js (app/api/search/route.ts):
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from '@/lib/embeddings';

export const runtime = 'edge'; // Use edge runtime for performance

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Track search performance
async function logSearchPerformance(
  query: string, 
  intent: string,
  duration: number,
  resultCount: number,
  timedOut: boolean
) {
  await supabase.rpc('log_search_performance', {
    p_query: query,
    p_intent: intent,
    p_vector_weight: 0.7,
    p_text_weight: 0.3,
    p_ef_search: 100,
    p_duration_ms: duration,
    p_result_count: resultCount,
    p_timed_out: timedOut
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const intent = searchParams.get('intent') || 'general';
  const topics = searchParams.getAll('topic');
  const locations = searchParams.getAll('location');
  const maxResults = Number(searchParams.get('limit')) || 20;
  
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }
  
  const startTime = Date.now();
  
  try {
    // Generate embeddings for search query
    const { embedding } = await generateEmbeddings(query);
    
    // Perform hybrid search
    const { data, error } = await supabase.rpc('hybrid_search', {
      p_query: query,
      p_query_embedding: embedding,
      p_query_intent: intent,
      p_query_topics: topics,
      p_query_locations: locations,
      p_max_results: maxResults,
      p_match_threshold: 0.6,
      p_vector_weight: 0.7,
      p_text_weight: 0.3,
      p_ef_search: 100
    });
    
    if (error) throw error;
    
    const duration = Date.now() - startTime;
    
    // Log search performance asynchronously (don't wait for it)
    logSearchPerformance(query, intent, duration, data.length, false)
      .catch(console.error);
    
    return NextResponse.json(
      { results: data, timing: { durationMs: duration } },
      { 
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    
    // If search fails, try fallback to text-only search
    try {
      const { data } = await supabase.rpc('simple_text_search', {
        search_query: query,
        max_results: maxResults
      });
      
      const duration = Date.now() - startTime;
      
      // Log the failure
      logSearchPerformance(query, intent, duration, data?.length || 0, true)
        .catch(console.error);
      
      return NextResponse.json({ 
        results: data || [], 
        fallback: true,
        timing: { durationMs: duration }
      });
    } catch (fallbackError) {
      console.error('Fallback search error:', fallbackError);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }
}
```

### Step 10: Create Embedding Generation Helper
Create the embeddings utility (lib/embeddings.ts):
```typescript
import { createClient } from '@supabase/supabase-js';
import { OpenAIApi, Configuration } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cache embeddings in memory
const embeddingCache = new Map<string, any>();

export async function generateEmbeddings(text: string) {
  // Check cache first
  const cacheKey = `embedding:${text}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }
  
  try {
    // Check database cache
    const { data: cachedEmbedding } = await supabase
      .from('embedding_cache')
      .select('embedding')
      .eq('text_hash', hashText(text))
      .maybeSingle();
      
    if (cachedEmbedding?.embedding) {
      embeddingCache.set(cacheKey, { embedding: cachedEmbedding.embedding });
      return { embedding: cachedEmbedding.embedding };
    }
    
    // Generate new embedding
    const response = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    const embedding = response.data.data[0].embedding;
    
    // Store in cache
    await supabase.from('embedding_cache').insert({
      text: text,
      text_hash: hashText(text),
      embedding: embedding,
      model: "text-embedding-ada-002"
    }).throwOnError();
    
    embeddingCache.set(cacheKey, { embedding });
    return { embedding };
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

// Simple text hashing function
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}
```

## Phase 5: Production Deployment & Monitoring

### Step 11: Set Up Monitoring Dashboard
Create a monitoring dashboard component (app/admin/search-performance/page.tsx):
```tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { LineChart, BarChart } from '@/components/charts';

export default async function SearchPerformancePage() {
  const supabase = createServerComponentClient({ cookies });
  
  // Get overall stats
  const { data: stats } = await supabase
    .from('search_performance_stats')
    .select('*')
    .order('time_bucket', { ascending: false })
    .limit(24);
    
  // Get recent slow queries
  const { data: slowQueries } = await supabase
    .from('slow_searches')
    .select('*')
    .limit(10);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Search Performance Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-2">Average Search Time</h2>
          <p className="text-3xl font-bold">
            {stats && stats.length > 0 
              ? `${Math.round(stats[0].avg_duration_ms)}ms` 
              : 'N/A'}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-2">p95 Search Time</h2>
          <p className="text-3xl font-bold">
            {stats && stats.length > 0 
              ? `${Math.round(stats[0].p95_duration_ms)}ms` 
              : 'N/A'}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-2">Timeout Rate</h2>
          <p className="text-3xl font-bold">
            {stats && stats.length > 0 
              ? `${(stats[0].timeout_count / stats[0].total_searches * 100).toFixed(2)}%` 
              : 'N/A'}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Search Performance Over Time</h2>
          {stats && <LineChart data={stats} />}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Performance by Intent</h2>
          {stats && <BarChart data={stats} />}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Recent Slow Searches</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Query</th>
              <th className="py-2 text-left">Intent</th>
              <th className="py-2 text-left">Duration (ms)</th>
              <th className="py-2 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {slowQueries?.map((query) => (
              <tr key={query.id} className="border-b">
                <td className="py-2">{query.query}</td>
                <td className="py-2">{query.intent}</td>
                <td className="py-2">{Math.round(query.duration_ms)}</td>
                <td className="py-2">
                  {new Date(query.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {(!slowQueries || slowQueries.length === 0) && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No slow searches recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Step 12: Create Comprehensive Testing Scripts
Create a test script for batch testing (scripts/test-search-performance.ts):
```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { generateEmbeddings } from '../lib/embeddings';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test queries
const TEST_QUERIES = [
  { query: 'best restaurants in NYC', intent: 'recommendation', locations: ['NYC'] },
  { query: 'how to fix javascript async bug', intent: 'how_to', topics: ['programming'] },
  { query: 'comparing iPhone vs Android', intent: 'comparison', topics: ['technology'] },
  { query: 'experiences with remote work', intent: 'experience', topics: ['work', 'remote'] },
  // Add more test queries...
];

// Run tests
async function runTests() {
  const results = [];
  
  for (const test of TEST_QUERIES) {
    console.log(`Testing query: "${test.query}"`);
    
    try {
      // Generate embeddings
      const startEmbed = Date.now();
      const { embedding } = await generateEmbeddings(test.query);
      const embedTime = Date.now() - startEmbed;
      
      // Run hybrid search
      const startSearch = Date.now();
      const { data, error } = await supabase.rpc('hybrid_search', {
        p_query: test.query,
        p_query_embedding: embedding,
        p_query_intent: test.intent,
        p_query_topics: test.topics || [],
        p_query_locations: test.locations || [],
        p_max_results: 20,
        p_match_threshold: 0.6,
        p_vector_weight: 0.7, 
        p_text_weight: 0.3,
        p_ef_search: 100
      });
      
      const searchTime = Date.now() - startSearch;
      const totalTime = embedTime + searchTime;
      
      if (error) throw error;
      
      // Record results
      results.push({
        query: test.query,
        intent: test.intent,
        embedTime,
        searchTime,
        totalTime,
        resultCount: data.length,
        error: null
      });
      
      console.log(`  Results: ${data.length} items in ${totalTime}ms (embed: ${embedTime}ms, search: ${searchTime}ms)`);
    } catch (error) {
      console.error(`  Error testing "${test.query}":`, error);
      
      results.push({
        query: test.query,
        intent: test.intent,
        embedTime: null,
        searchTime: null,
        totalTime: null,
        resultCount: 0,
        error: error.message
      });
    }
  }
  
  // Write results to file
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const resultsPath = path.join(process.cwd(), 'search-test-results', `results-${timestamp}.json`);
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  
  // Write results
  fs.writeFileSync(
    resultsPath, 
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\nTest complete. Results saved to ${resultsPath}`);
  
  // Calculate and display summary
  const successful = results.filter(r => !r.error);
  const avgTotal = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
  const avgEmbed = successful.reduce((sum, r) => sum + r.embedTime, 0) / successful.length;
  const avgSearch = successful.reduce((sum, r) => sum + r.searchTime, 0) / successful.length;
  
  console.log('\nSummary:');
  console.log(`  Total queries: ${results.length}`);
  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${results.length - successful.length}`);
  console.log(`  Avg total time: ${Math.round(avgTotal)}ms`);
  console.log(`  Avg embedding time: ${Math.round(avgEmbed)}ms`);
  console.log(`  Avg search time: ${Math.round(avgSearch)}ms`);
}

// Run the tests
runTests().catch(console.error);
```

This comprehensive implementation plan covers all aspects of implementing and optimizing the hybrid search function, from database functions to application integration, performance testing, and monitoring.
