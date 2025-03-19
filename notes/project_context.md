
# LocalGuru: Technical Documentation

## 1. Project Overview

LocalGuru is a sophisticated semantic search platform for discovering location-specific content. It offers:

- Semantic search with vector embeddings for natural language understanding
- Intent-driven search tailored to various query types (recommendations, comparisons, how-to, etc.)
- Location-aware results to provide geographically relevant information
- Metadata-enriched content with topics, entities, and location extraction
- Performance optimizations including response caching and rate limiting

## 2. System Architecture

### Frontend (Next.js)
- **Client Components**: Main search interface in `app/page.tsx` with a modern UI
- **API Routes**: Server-endpoints for querying the backend (`app/api/search`, `api/feedback`, etc.)
- **Middleware**: Security headers and rate limiting implemented in `app/middleware.ts`

### Backend (Supabase)
- **PostgreSQL Database**: Core storage with pgvector extension for vector operations
- **Edge Functions**: Serverless compute for search processing, embedding generation, and content analysis
- **SQL Functions**: Multi-strategy search implementation using sophisticated vector operations

## 3. Database Schema

The database follows a content-representation model:

### Primary Tables
1. **content**: Central table for storing all searchable content
   - id, title, content, url, subreddit, author, content_type, created_at

2. **content_representations**: Vector embeddings of content with different representation strategies
   - id, parent_id, content_type, representation_type, embedding, created_at, metadata

3. **reddit_posts/reddit_comments**: Source-specific content tables with metadata
   - Enriched with extracted entities, topics, locations, and semantic tags

4. **embedding_cache**: Performance optimization for query embedding generation
   - Stores pre-computed embeddings to avoid redundant API calls

5. **search_feedback**: User feedback on search results for quality improvement

### Indexing
- Vector indexes (IVF-Flat) on embeddings for fast similarity search
- Standard indexes on metadata fields for filtering operations

## 4. Search System

The multi-strategy search function (`multi_strategy_search`) serves as the core search engine:

### Search Pipeline
1. **Query Analysis**: AI-powered intent detection and metadata extraction
   - Uses OpenAI to classify query intent (recommendation, information, etc.)
   - Extracts entities, topics, and locations from queries
   - Enhances analysis with dietary preferences, price sensitivity detection, etc.

2. **Query Embedding**: Vector representation of search queries
   - Uses text-embedding-3-small model from OpenAI
   - Implements caching for performance optimization

3. **Multi-Strategy Search**: Combines multiple search strategies
   - Basic content representation
   - Title-focused search
   - Context-enhanced search
   - Location-boosted search
   - Topic-boosted search
   - Intent-specific optimizations

4. **Dynamic Boosting**: Adjusts relevance scores based on intent
   - Different boost factors for different representation types
   - Enhanced boosting for specialized intents (how-to, comparison, etc.)

5. **Result Formatting**: Processes raw results into user-friendly format
   - Content snippet generation
   - Metadata preparation for display
   - Deduplication and ranking

## 5. Technical Implementations

### Vector Search Implementation
The system uses cosine similarity between embeddings with PostgreSQL's pgvector extension:
- Operator: `<=>` for cosine distance measurement
- Indexes: IVF-Flat indexes with 100 lists for efficient retrieval
- Threshold: Configurable similarity threshold (default 0.6)

### Caching Strategy
Multiple caching layers for performance:
- Query embedding cache in database (7-day TTL)
- In-memory result cache in API endpoint (10-minute TTL)
- Automatic cache cleanup to prevent memory leaks

### Rate Limiting
Implemented in middleware with:
- 60 requests per minute default limit
- IP-based or API-key based identification
- Custom headers for rate limit information

## 6. Edge Functions

The system uses several Supabase Edge Functions:

1. **query-analysis**: Analyzes search queries with AI
   - Intent detection, entity extraction
   - Location and topic identification
   - Enhanced with specialized detectors for dietary preferences, etc.

2. **query-embeddings**: Generates vector embeddings
   - OpenAI text-embedding-3-small model
   - Caching system for performance

3. **search**: Legacy direct search endpoint (now handled by API routes)

4. **feedback**: Collects user feedback on search results

5. **process-queue**: Background job for processing content embedding generation

## 7. Advanced Features

1. **Intent-Based Optimization**:
   - Different search strategies based on detected intent
   - Specialized handling for recommendation vs information vs how-to queries
   - Dynamic boosting of title vs content vs context based on intent

2. **Location Awareness**:
   - Geographic relevance through location extraction
   - Boosting content with locations matching user query
   - Location metadata in content representations

3. **Feedback Loop**:
   - User feedback collection system
   - Structured storage for future search quality improvements

## 8. Performance Considerations

1. **Response Times**: 
   - Caching strategy for repeated queries
   - Vector search optimization with proper indexing
   - Concurrent execution of analysis and embedding generation

2. **Scalability**:
   - Rate limiting to prevent API abuse
   - Efficient use of external API calls (OpenAI)
   - Background processing for content embedding generation

3. **Error Handling**:
   - Comprehensive error logging
   - Fallback strategies for component failures
   - Graceful error responses to client

## 9. Development Workflow

The project includes several deployment scripts and testing utilities:
- Database migration scripts for schema changes
- Deployment scripts for function updates
- Diagnostic tools for checking vector operations
- Testing scripts for query performance analysis

## 10. Technical Debt & Future Improvements

Areas for potential improvement:
- Enhanced feedback collection and analysis
- Streaming search responses for faster perceived performance
- Additional metadata extraction for better categorization
- Improved content representation strategies
- Performance optimizations for large-scale deployment

This document provides a comprehensive overview of the LocalGuru system architecture and implementation details, serving as a guide for engineers working on the project.
