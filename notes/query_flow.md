
# LocalGuru Query Flow: Detailed Technical Breakdown

## 1. Query Initiation

**Client → Server Path:**
```
SearchBar component → app/page.tsx → /api/search endpoint → app/api/search/route.ts
```

**Process:**
1. User enters a search query in the `SearchBar` component
2. `handleSearch` function in `app/page.tsx` sends a POST request to `/api/search`
3. Request includes parameters: `query`, `maxResults`, `includeAnalysis`, `skipCache`
4. Middleware (`app/middleware.ts`) intercepts the request to apply rate limiting
5. `POST` handler in `app/api/search/route.ts` validates the request and initiates search flow

## 2. Search Execution

**Entry Point:**
```typescript
// in app/api/search/route.ts
const result = await performFullSearch(options);
```

**Flow Breakdown:**

### 2.1. Cache Check
```
performFullSearch() → createCacheKey() → SEARCH_CACHE lookup
```

- Generates a cache key from normalized query text
- Checks in-memory cache for existing results
- If found and not expired (within 10 min TTL), returns cached results

### 2.2. Parallel Operations
```
Promise.all([analyzeQuery(), generateEmbeddings()])
```

#### 2.2.1. Query Analysis
```
analyzeQuery() → Supabase Edge Function → query-analysis function → OpenAI API
```

- Invokes `query-analysis` edge function
- Edge function calls OpenAI to analyze query intent, entities, topics, and locations
- Enhances analysis with:
  - `enhanceDietaryPreferences()` 
  - `enhancePriceSensitivity()`
  - `enhanceTimeRelevance()`
  - `transferLocationsFromEntities()`
  - `enhanceIntentDetection()`
- Returns a structured analysis:
  ```json
  {
    "entities": { ... },
    "topics": ["food", "vegan", ...],
    "locations": ["san francisco", ...],
    "intent": "recommendation"
  }
  ```

#### 2.2.2. Embedding Generation
```
generateEmbeddings() → Supabase Edge Function → query-embeddings function → OpenAI API → embedding_cache
```

- Invokes `query-embeddings` edge function
- Function generates a cache key via MD5 hash of query
- Checks `embedding_cache` table for existing entry
- If not found, calls OpenAI API for text-embedding-3-small
- Stores embedding in cache with 7-day TTL
- Returns 1536-dimensional vector

### 2.3. Database Search
```
executeSearch() → supabaseAdmin.rpc('multi_strategy_search') → PostgreSQL execution
```

- Calls database function with parameters:
  - `p_query`: Original text query
  - `p_query_embedding`: Vector embedding
  - `p_query_intent`: Detected intent (recommendation, information, etc.)
  - `p_query_topics`: Extracted topics
  - `p_query_locations`: Extracted locations
  - `p_max_results`: Result limit
  - `p_match_threshold`: Similarity threshold (default 0.6)

## 3. Multi-Strategy Search Execution

**Database Function:** `multi_strategy_search`

**Execution Flow:**

### 3.1. Boost Configuration
```sql
-- Set boost factors based on query intent
CASE p_query_intent
  WHEN 'recommendation' THEN
    v_content_boost := 1.0;
    v_title_boost := 1.8;
    ...
```

- Dynamically sets boost values for different content types based on query intent
- Different intents prioritize different aspects (title, content, location, topics)

### 3.2. Parallel Search Strategies
```sql
-- Strategy 1: Basic content representation search
(SELECT ... FROM content_representations cr WHERE representation_type = 'basic' ...)
UNION ALL
-- Strategy 2: Title representation search
(SELECT ... FROM content_representations cr WHERE representation_type = 'title' ...)
...
```

Five core search strategies execute in parallel:

1. **Basic Content Search**: Matches against standard content representations
2. **Title Search**: Prioritizes matches in content titles
3. **Context-Enhanced Search**: Uses enriched context representations
4. **Location-Boosted Search**: Prioritizes content matching query locations
5. **Topic-Boosted Search**: Prioritizes content matching query topics

### 3.3. Intent-Specific Optimizations
```sql
-- Special optimization for how_to intent
(SELECT ... WHERE p_query_intent = 'how_to' AND c.title ILIKE 'how to%' ...)
```

- Additional specialized search strategies for particular intents
- Special handling for "how-to" content, dating topics, etc.

### 3.4. Result Processing
```sql
-- Deduplicate results
SELECT DISTINCT ON (result_id) ... FROM search_results ORDER BY result_id, result_match_score DESC
```

- Deduplicates results (same content may match multiple strategies)
- Keeps highest match score for each content item
- Orders by match score
- Limits to requested number of results

## 4. Result Processing

**Server Processing:**
```
performFullSearch() → resultFormatter() → Response JSON
```

- Formats raw database results for frontend display
- Generates content snippets
- Adds performance metrics
- Stores results in memory cache for future queries
- Returns structured JSON response

## 5. Client Rendering

**Data Flow:**
```
API Response → page.tsx → ResultsContainer → Result cards
```

- Results passed to `ResultsContainer` component
- Individual results rendered as cards
- Metadata displayed (processing time, cache status)
- Optional refresh button for cached results

## 6. Feedback Loop (Optional)

**Flow:**
```
User feedback → handleFeedback() → /api/feedback endpoint → Supabase
```

- User provides positive/negative feedback on results
- Feedback sent to `/api/feedback` endpoint
- Stored in `search_feedback` table for future analysis

## Key Components Interaction Diagram

```
Frontend (Next.js)          │ Backend (Next.js API)         │ Supabase                 │ External Services
────────────────────────────┼───────────────────────────────┼──────────────────────────┼─────────────────────
                            │                               │                          │
SearchBar                   │                               │                          │
    │                       │                               │                          │
    ▼                       │                               │                          │
page.tsx                    │                               │                          │
    │ fetch()               │                               │                          │
    ├─────────────────────────►middleware.ts (rate limit)   │                          │
    │                       │     │                         │                          │
    │                       │     ▼                         │                          │
    │                       │ api/search/route.ts           │                          │
    │                       │     │                         │                          │
    │                       │     ├─────────────────────────►query-analysis Edge Func  │
    │                       │     │                         │     │                    │
    │                       │     │                         │     ├───────────────────────► OpenAI API
    │                       │     │                         │     │                    │
    │                       │     │                         │     ▼                    │
    │                       │     │                         │ embedding_cache table    │
    │                       │     │                         │     │                    │
    │                       │     ├─────────────────────────►query-embeddings Edge Func│
    │                       │     │                         │     │                    │
    │                       │     │                         │     ├───────────────────────► OpenAI API
    │                       │     │                         │     │                    │
    │                       │     │                         │     ▼                    │
    │                       │     ├─────────────────────────►multi_strategy_search     │
    │                       │     │                         │     │                    │
    │                       │     │                         │     ▼                    │
    │                       │     │                         │ content_representations  │
    │                       │     │                         │     │                    │
    │                       │     │                         │     ▼                    │
    │                       │     │                         │ content table            │
    │                       │     │                         │     │                    │
    │                       │     ◄─────────────────────────┴─────┘                    │
    │                       │     │                         │                          │
    │                       │     ▼                         │                          │
    │                       │ formatSearchResults()         │                          │
    │                       │     │                         │                          │
    │                       │     ▼                         │                          │
    ◄─────────────────────────┘ JSON Response               │                          │
    │                       │                               │                          │
    ▼                       │                               │                          │
ResultsContainer            │                               │                          │
    │                       │                               │                          │
    ▼                       │                               │                          │
User provides feedback      │                               │                          │
    │ fetch()               │                               │                          │
    ├─────────────────────────►api/feedback/route.ts        │                          │
    │                       │     │                         │                          │
    │                       │     ├─────────────────────────►search_feedback table     │
    │                       │     │                         │                          │
    ◄─────────────────────────┘     │                       │                          │
                            │                               │                          │
```

## Performance Optimizations

1. **Dual Caching System**:
   - API-level caching: 10-minute TTL in memory
   - Embedding-level caching: 7-day TTL in database

2. **Parallel Processing**:
   - Concurrent execution of query analysis and embedding generation
   - Multiple search strategies executed in parallel in SQL

3. **Vector Optimizations**:
   - IVF-Flat index on embeddings for sublinear search time
   - Similarity threshold to limit search space

4. **Content Preprocessing**:
   - Multiple representation types stored in advance
   - Metadata extraction during content ingestion

This detailed flow illustrates how LocalGuru's sophisticated search system processes queries from end to end, combining multiple AI components, vector search techniques, and performance optimizations to deliver relevant location-based content.
