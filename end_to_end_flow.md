# LocalGuru: End-to-End Flow Documentation

## Overview

LocalGuru is a local search answer engine that provides AI-powered answers about local recommendations. The application leverages Next.js 14 with TypeScript for the frontend and integrates with Supabase as the backend database. The architecture implements a streaming approach that provides real-time updates to users.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├────────────┬────────────┬─────────────────────┬────────────────┤
│  Components│    Hooks   │     API Routes      │   Middleware   │
│            │            │                     │                │
│ SearchBar  │ useStreami │ /api/streaming-     │ Rate limiting  │
│ Location   │ ngSearch   │ search             │ Security       │
│ Selector   │            │ /api/feedback       │ headers        │
│ Streaming  │            │ /api/search         │                │
│ Results    │            │ /api/query-analysis │                │
└────────────┴────────────┴─────────────────────┴────────────────┘
                                ▲
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                            │
├────────────────────┬──────────────────────┬───────────────────┤
│  Supabase          │   External APIs      │  Search Engine    │
│                    │                      │                   │
│ Vector database    │   Anthropic Claude   │  Vector search    │
│ Edge functions     │                      │  Text search      │
│ PostgreSQL RPC     │                      │  Hybrid search    │
│                    │                      │  HNSW indexing    │
└────────────────────┴──────────────────────┴───────────────────┘
```

## User Flow

1. User visits the website
2. User selects a location (if applicable)
3. User enters a search query
4. System processes the query and returns relevant results
5. AI generates a narrative response based on search results
6. User can provide feedback on results

## Frontend Component Hierarchy

```
app/page.tsx
├── Header
│   └── LocationSelector
├── SearchBar
├── StreamingResults
│   ├── MarkdownRenderer
│   └── ResultsContainer
│       └── ResultCard
└── ScrollingBanner
```

## Key Components Detailed

### Page Component (`app/page.tsx`)

The main page component orchestrates the application and includes:
- Header with location selector
- Search interface
- Results display
- Floating search bar (appears on scroll)
- Footer with scrolling banner

It manages the main state using the `useStreamingSearch` hook and coordinates the user flow.

### SearchBar (`components/search-bar.tsx`)

Handles user input with a clean form interface:
- Input field with placeholder text
- Submit button
- Voice search capability (UI only)
- Proper keyboard event handling (Enter key submission)

### LocationSelector (`components/location-selector.tsx`)

Dropdown component for selecting location:
- Uses internal state for dropdown visibility
- Notifies parent component of location changes
- Styled consistently with the application design

### StreamingResults (`components/streaming-results.tsx`)

Displays real-time search results:
- Status indicators for different search phases
- Loading animations
- Error handling
- Integration with MarkdownRenderer for content display

### MarkdownRenderer (`components/markdown-renderer.tsx`)

Renders AI-generated content with rich formatting:
- Supports markdown syntax with React Markdown
- Implements citation tooltips
- Handles code blocks with syntax highlighting
- Processes source links in content

## Data Flow

### Search Process

```
┌──────────┐    ┌────────────────┐    ┌─────────────────┐
│  User    │    │  useStreaming  │    │  API Endpoint   │
│  Action  │───▶│  Search Hook   │───▶│  /streaming-    │
└──────────┘    └────────────────┘    │  search         │
                        │             └─────────────────┘
                        │                      │
                        │                      ▼
                        │             ┌─────────────────┐
                        │             │ performFullSearch│
                        │             └─────────────────┘
                        │                      │
                        │                      ▼
                        │             ┌─────────────────┐
                        │             │ formatResults   │
                        │             │ for LLM         │
                        │             └─────────────────┘
                        │                      │
                        │                      ▼
                        │             ┌─────────────────┐
                        │             │ Claude API      │
                        │             │ (Streaming)     │
                        │             └─────────────────┘
                        │                      │
                        ▼                      ▼
                ┌─────────────────────────────────┐
                │       StreamingResults          │
                │       Component                 │
                └─────────────────────────────────┘
```

### Backend Search Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                 Query Processing Pipeline                             │
├─────────┬───────────────┬─────────────────┬───────────────────────────┤
│ Query   │ Query Analysis│ Embedding       │ Search Execution          │
│ Input   │ Edge Function │ Generation      │                           │
│         │               │                 │                           │
│         │ ┌───────────┐ │ ┌────────────┐ │ ┌───────────────────────┐ │
│         │ │Extract:   │ │ │Vector      │ │ │Hybrid Search:         │ │
│ User    │ │- Topics   │ │ │Embedding   │ │ │- Vector similarity    │ │
│ Query   │ │- Locations│ │ │Generation  │ │ │- Text matching        │ │
│         │ │- Entities │ │ │(OpenAI API)│ │ │- Metadata boosting    │ │
│         │ │- Intent   │ │ │            │ │ │- Fallback mechanisms  │ │
│         │ └───────────┘ │ └────────────┘ │ └───────────────────────┘ │
└─────────┴───────────────┴─────────────────┴───────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 Supabase Implementation                               │
├───────────────┬────────────────────┬─────────────────────────────────┤
│ Edge Functions│ PostgreSQL RPC     │ Database Structure              │
│               │                    │                                  │
│ - query-      │ - comment_only_    │ - pgvector extension            │
│   analysis    │   search_with_     │ - HNSW indexing                 │
│ - query-      │   timeout          │ - Comments & Posts tables       │
│   embeddings  │ - fallback text    │ - Metadata fields               │
│               │   search           │ - Vector embeddings             │
└───────────────┴────────────────────┴─────────────────────────────────┘
```

## API Routes Implementation

The application uses a set of specialized API routes to handle different aspects of the search process. These routes work together to form a complete search pipeline:

### API Route Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    API Routes System                                 │
├────────────────────┬───────────────────────┬─────────────────────────┤
│ /api/query-analysis│    /api/embeddings    │  /api/streaming-search  │
│                    │                       │                         │
│ • Analyzes user    │  • Generates vector   │  • Orchestrates entire  │
│   query intent     │    embeddings         │    search process       │
│ • Extracts topics, │  • Uses OpenAI        │  • Performs search      │
│   locations        │    embedding model    │  • Streams AI responses │
│ • Determines       │  • Caches results     │  • Handles fallbacks    │
│   search intent    │    for efficiency     │    and retries          │
└────────────────────┴───────────────────────┴─────────────────────────┘
```

### 1. Query Analysis Route (`app/api/query-analysis/route.ts`)

This route handles semantic analysis of user queries:

- **Functionality**:
  - Extracts meaningful information from natural language queries
  - Identifies topics, locations, entities, and search intent
  - Proxies requests to Supabase Edge Function securely

- **Flow**:
  1. Validates incoming query parameters
  2. Logs the analysis request (for monitoring)
  3. Calls `analyzeQuery()` function from query processor
  4. Returns structured analysis with standardized response format
  5. Implements error handling with dedicated utilities

- **CORS Support**:
  - Includes OPTIONS handler for cross-origin requests
  - Sets appropriate security headers

### 2. Embeddings Route (`app/api/embeddings/route.ts`)

This route generates vector embeddings for semantic search:

- **Functionality**:
  - Converts text queries into numeric vector representations
  - Proxies requests to the Supabase embedding edge function
  - Returns embeddings for use in vector similarity search

- **Flow**:
  1. Validates incoming query
  2. Logs embedding requests (without sensitive data)
  3. Calls `generateEmbeddings()` function
  4. Returns vector embeddings with proper security measures
  5. Handles errors with standardized response format

- **Security Considerations**:
  - Only returns necessary data to minimize exposure
  - Validates input to prevent injection attacks
  - Implements proper error handling

### 3. Streaming Search Route (`app/api/streaming-search/route.ts`)

This is the primary search endpoint with streaming capabilities:

- **Core Functionality**:
  - Integrates all search steps into a single streaming pipeline
  - Uses Edge Runtime for optimal performance and reduced cold starts
  - Streams results in real-time as they become available

- **Implementation Details**:
  - Configured with `export const runtime = 'edge'` for optimal performance
  - Uses ReadableStream API to create a streaming response
  - Implements JSON-based protocol for streaming content and status updates

- **Search Process Flow**:
  1. Parses request with hybrid search parameters (vector/text weights)
  2. Creates text encoder for streaming responses
  3. Sends initial "initializing" and "searching" status updates
  4. Executes full search with configurable parameters:
     ```typescript
     const searchResponse = await performFullSearch({
       query,
       maxResults: maxResults,
       includeAnalysis: true,
       skipCache: skipCache,
       vectorWeight: vectorWeight,
       textWeight: textWeight,
       efSearch: efSearch,
       similarityThreshold: 0.6
     });
     ```
  5. Logs detailed search results for monitoring
  6. Sends "search_complete" status with result count
  7. Formats results for LLM consumption
  8. Gets appropriate system prompt based on search context
  9. Sends "generating" status update
  10. Formats and sends early metadata to client for instant result display
  11. Makes direct API call to Anthropic Claude with streaming enabled

- **Error Handling and Resilience**:
  - Implements retry logic with exponential backoff for Anthropic API calls
  - Handles service overload gracefully
  - Provides meaningful error messages to clients
  - Includes fallback content for overload scenarios

- **Streaming Protocol**:
  - Uses a custom message format with type identifiers:
    - `{ type: 'status', status: 'initializing|searching|search_complete|generating|complete|error' }`
    - `{ type: 'content', content: '...' }` for incremental content updates
    - Special `METADATA:` prefix for result metadata
  - Properly handles SSE (Server-Sent Events) parsing from Anthropic API
  - Accumulates and forwards Claude's streamed responses

- **Diagnostic Capabilities**:
  - Includes GET endpoint for debugging payload structure
  - Provides detailed logging throughout the process
  - Tracks timing metrics for performance analysis

### API Routes Integration

The individual API routes collaborate through the following pattern:

1. **Progressive Request Chain**:
   - The frontend makes a single request to `/api/streaming-search`
   - This route internally orchestrates calls to multiple backend services
   - Results are streamed back as they become available

2. **Service Independence**:
   - Each API route can also be called independently for specialized use cases
   - `/api/query-analysis` and `/api/embeddings` serve as utility endpoints
   - Modular design allows for targeted testing and development

3. **Shared Infrastructure**:
   - All routes use the same error handling and response formatting utilities
   - Common middleware applies security headers and rate limiting
   - Consistent logging for monitoring and diagnostics

This API route architecture provides both the integrated streaming experience for the main search flow while maintaining modular components that can be tested, optimized, and scaled independently.

### Streaming Implementation

The search uses Server-Sent Events (SSE) to stream updates:

1. User submits search query
2. Frontend makes a POST request to `/api/streaming-search`
3. Backend starts processing:
   - Initializes stream
   - Performs search against database
   - Sends search complete status
   - Forwards formatted results to LLM
   - Streams LLM response back as it's generated
4. Frontend receives and processes streamed updates:
   - Updates status indicators
   - Renders content progressively
   - Displays search results
   - Shows completion notification

## Search System Deep Dive

### Query Processing (`app/lib/search/query-processor.ts`)

The query processor is the core of the search system, responsible for:

1. **Query Analysis**: 
   - Calls Supabase Edge Function `query-analysis` to extract:
     - Topics (e.g., "dining", "outdoors", "nightlife")
     - Locations (e.g., "San Francisco", "Mission District")
     - Entities (categorized named entities)
     - Intent classification (recommendation, information, etc.)

2. **Embedding Generation**:
   - Generates vector embeddings using the `query-embeddings` Edge Function
   - Includes fallback mechanism for direct OpenAI API calls if the Edge Function fails
   - Uses `text-embedding-3-large` with 512 dimensions

3. **Search Execution**:
   - Performs hybrid search using both vector similarity and text matching
   - Calls the PostgreSQL function `comment_only_search_with_timeout`
   - Implements timeout handling with fallback to text search
   - Applies metadata boosting based on topic and location relevance
   - Returns formatted results with relevance scores

4. **Caching System**:
   - Implements in-memory caching for search results
   - Uses TTL-based expiration (10 minutes)
   - Creates cache keys based on search parameters
   - Includes cleanup mechanisms to prevent memory leaks

### Stream Processing (`app/lib/search/stream-processor.ts`)

The stream processor handles formatting and preparing data for both the LLM and client:

1. **LLM Formatting**:
   - `formatSearchResultsForLLM`: Formats search results for LLM consumption
   - Structures results with titles, content, metadata, and source information
   - Optimizes token usage while retaining important context

2. **Client Formatting**:
   - `formatResultForClient`: Prepares results for frontend display
   - Adds 1-based indexing for citation referencing
   - Truncates content to manageable preview sizes
   - Normalizes date formats and handles missing fields

3. **Token Estimation**:
   - Includes utilities to estimate token counts
   - Ensures content fits within LLM context windows

### Types System (`app/lib/search/types.ts`, `app/lib/supabase/types.ts`)

The application uses a robust type system to ensure consistency across the search pipeline:

1. **Search Types**:
   - `SearchOptions`: Parameters for configuring search behavior
   - `FormattedSearchResult`: Frontend-friendly result structure
   - `SearchResponse`: Standardized API response format
   - `FeedbackOptions`: Structure for user feedback data

2. **Supabase Types**:
   - `QueryAnalysisResult`: Output from query analysis
   - `EmbeddingResult`: Vector embedding data
   - `SearchResult`: Database search result structure
   - Includes detailed metadata typing for thread context, topics, locations

3. **Streaming Types**:
   - `StreamingStatus`: State machine for streaming process
   - `StreamingUpdate`: Update message format
   - `StreamingResponseMetadata`: Final metadata package

## Supabase Integration Deep Dive

### Supabase Client (`app/lib/supabase/client-server.ts`)

The application implements secure Supabase connections:

1. **Admin Client**:
   - Uses service role key for privileged operations
   - Securely configured for server-side only
   - Validates environment variables at startup

2. **Anonymous Client**:
   - Alternative client with restricted permissions
   - Used when full admin access is not needed

3. **Health Checking**:
   - `checkSupabaseConnection`: Validates database connectivity
   - Uses lightweight RPC call for status verification

### Database Operations

1. **Vector Search**:
   - Uses pgvector extension for vector similarity
   - Implements HNSW (Hierarchical Navigable Small World) indexing for performance
   - Configurable search parameters (efSearch, similarity thresholds)

2. **Hybrid Search**:
   - Combines vector similarity with text search
   - Adjustable weighting between vector and text components
   - Metadata boosting based on topic and location relevance

3. **Timeout Handling**:
   - Implements SQL-level timeout mechanisms
   - Graceful fallback to text search if vector search times out
   - Performance monitoring through timing measurements

## Error Handling and API Utilities

### Error Handling (`app/lib/utils/error-handling.ts`)

The application implements comprehensive error handling:

1. **Custom Error Types**:
   - `ApiError`: Error class with HTTP status codes
   - Standardized error format for consistent client responses

2. **Error Processing**:
   - `handleApiError`: Central error handling function
   - Converts various error types to appropriate HTTP responses
   - Special handling for Supabase-specific errors

3. **Error Logging**:
   - `logApiError`: Secure error logging utility
   - Sanitizes sensitive information before logging
   - Contextual logging with source information

### API Response Utilities (`app/lib/utils/api-response.ts`)

Standardized API response formatters:

1. **Success Responses**:
   - `successResponse`: Standard success format
   - Includes appropriate headers and status codes

2. **Error Responses**:
   - `errorResponse`: Standard error format
   - `notFoundResponse`: 404 convenience method
   - `unauthorizedResponse`: 401 convenience method
   - `timeoutResponse`: Special handling for timeouts with partial results

3. **Header Management**:
   - Consistent header application
   - Cache control directives
   - Connection handling

## Search Process Detailed

1. **Query Input**:
   - User enters query in SearchBar component
   - SearchBar calls `onSearch` function from parent
   - Parent component calls `search` method from hook

2. **API Request**:
   - `useStreamingSearch` hook makes POST request to `/api/streaming-search`
   - Request includes query and search parameters (vector weight, threshold, etc.)

3. **Backend Processing**:
   - API route validates request
   - Sets up streaming response with `ReadableStream`
   - Calls `performFullSearch` to execute the complete search pipeline:
     - Parallel execution of query analysis and embedding generation
     - Timeout handling with `Promise.race`
     - Fallback mechanisms for resilience
     - Cache checking/updating
   - Formats results for LLM consumption
   - Sends early metadata to client with search results
   - Calls Claude API with streaming enabled

4. **Streaming Response**:
   - API route streams status updates and content chunks
   - Uses a text encoder to prepare byte sequences
   - Includes error handling and retry logic
   - Client processes chunks through streaming decoder

5. **Result Display**:
   - StreamingResults component shows appropriate status indicators
   - MarkdownRenderer processes and displays content
   - Citations link to original sources with proper indexing

## Feedback Mechanism

- Result cards include thumbs up/down buttons
- Feedback is sent to `/api/feedback` endpoint
- Structured feedback data includes:
  - Content ID reference
  - Original query
  - Binary helpfulness indicator
  - Optional user comments
  - Source tracking
- Feedback helps improve search quality over time

## Performance Optimizations

The application implements several performance optimizations:

1. **Database Level**:
   - HNSW indexing for fast approximate nearest neighbor search
   - Configurable search parameters (`efSearch`)
   - SQL-level timeout handling
   - Hybrid search with adjustable weights

2. **API Level**:
   - Edge runtime for API routes
   - Streamed responses for better perceived performance
   - In-memory caching with TTL expiration
   - Parallel request execution for analysis and embeddings

3. **Frontend Level**:
   - Progressive content rendering
   - Status indicators for user feedback
   - Throttled scroll handling
   - Optimized markdown rendering

## Error Handling

The application implements comprehensive error handling:
- API request errors with standardized responses
- Search processing errors with fallback mechanisms
- LLM generation errors with retry logic
- Network disconnections handled in the streaming client
- Rate limiting errors with appropriate status codes
- Timeout handling at multiple levels (SQL, API, overall request)

All errors are gracefully handled with appropriate UI feedback to users.

## Conclusion

LocalGuru implements a sophisticated search architecture with multiple layers of optimization and error handling. The hybrid search approach combines the strengths of vector search and traditional text search, while the streaming implementation provides a responsive user experience. The modular design with clean separation of concerns allows for easy maintenance and extension of the system. 