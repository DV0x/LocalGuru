# Search Architecture

## Overview

The search system in LocalGuru is built around a hybrid search approach that combines vector similarity search with traditional text search for optimal results. The architecture leverages PostgreSQL with the pgvector extension, HNSW vector indexes, and a two-phase retrieval approach for efficient performance.

## Key Components

### 1. Search Functions

PostgreSQL database functions that implement the search logic:

- **comment_only_search_with_timeout**: Primary search function for comment content
- **hybrid_search**: General-purpose hybrid search across content types
- **intent_multi_strategy_search**: Intent-aware search with multiple strategies

### 2. Vector Embeddings

Content is represented as high-dimensional vectors:

- **Content Representations**: Multiple embedding types per content
- **Embedding Model**: Using OpenAI's text-embedding-3-small (512 dimensions)
- **Representation Types**: Context-enhanced, basic, chunked

### 3. Vector Indexes

HNSW (Hierarchical Navigable Small World) indexes for efficient vector search:

- **Index Structure**: Approximate nearest neighbor search
- **Parameters**: Optimized ef_construction and m values
- **Performance Tuning**: Configurable ef_search parameter

### 4. Text Search

PostgreSQL full-text search capabilities:

- **Search Vectors**: GIN-indexed tsvector columns
- **Query Parsing**: websearch_to_tsquery for natural language
- **Ranking**: ts_rank_cd for relevance scoring

## Search Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     User Query                                  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     Query Processing                            │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Text Analysis   │  │ Vector          │  │ Intent          │  │
│  │                 │  │ Embedding       │  │ Detection       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     Two-Phase Retrieval                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Phase 1: Candidate Retrieval                            │   │
│  │ • Vector similarity search with HNSW                     │   │
│  │ • Text search with websearch_to_tsquery                  │   │
│  │ • Combined candidate pool                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Phase 2: Re-Ranking                                     │   │
│  │ • Hybrid scoring (vector + text)                         │   │
│  │ • Weighted combination                                   │   │
│  │ • Final result limiting                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     Result Processing                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Metadata        │  │ Formatting      │  │ Feedback        │  │
│  │ Enrichment      │  │                 │  │ Collection      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Two-Phase Retrieval Approach

The search implementation uses a two-phase retrieval approach for better performance:

### Phase 1: Candidate Retrieval

In the first phase, the system efficiently retrieves a pool of potential matches:

1. **Vector Similarity Search**:
   - Uses pre-computed embeddings and HNSW index
   - Applies a relaxed similarity threshold (50% of final threshold)
   - Retrieves twice as many results as needed for final output

2. **Text Search**:
   - Uses PostgreSQL's websearch_to_tsquery on indexed content
   - Captures exact keyword matches
   - Adds results to the candidate pool

### Phase 2: Re-Ranking

The second phase applies more sophisticated scoring to the candidate pool:

1. **Hybrid Scoring Formula**:
   ```
   (vector_similarity * vector_weight + text_rank * text_weight)
   ```

2. **Weighted Combination**:
   - Configurable weights between vector and text components
   - Default: 70% vector similarity, 30% text relevance

3. **Final Selection**:
   - Results ordered by combined score
   - Limited to requested number of results

## Performance Optimizations

### Timeout Handling

To ensure search responsiveness even with large datasets:

1. **Statement Timeout**:
   - Configurable timeout setting (default: 9000ms)
   - Prevents long-running queries from affecting UX

2. **Fallback Strategy**:
   - If the full hybrid search times out, falls back to text-only search
   - Text search is significantly faster but may be less semantically relevant
   - Returns a flag indicating timeout occurred

### HNSW Index Optimization

The HNSW vector index is optimized for performance:

1. **Index Construction Parameters**:
   - ef_construction = 128 (balance between build time and quality)
   - m = 16 (connections per node, higher means better recall but more space)

2. **Search Parameter**:
   - ef_search = 400 (increased from 100 for better recall)
   - Dynamically configurable per query

### Query Embedding Cache

To reduce computation overhead:

1. **Embedding Cache Table**:
   - Stores query text and corresponding vector embeddings
   - Indexed by query hash for fast retrieval

2. **Cache Strategy**:
   - Frequently used queries are served from cache
   - Automatic invalidation for older entries

## Search Configuration Parameters

The search functions support numerous configuration parameters:

| Parameter | Purpose | Default |
|-----------|---------|---------|
| p_query | Text search query | Required |
| p_query_embedding | Vector representation of query | Required |
| p_query_intent | Detected intent of query | 'general' |
| p_query_topics | Relevant topics | [] |
| p_query_locations | Relevant locations | [] |
| p_max_results | Maximum results to return | 50 |
| p_match_threshold | Minimum similarity threshold | 0.4 |
| p_vector_weight | Weight for vector similarity | 0.7 |
| p_text_weight | Weight for text relevance | 0.3 |
| p_ef_search | HNSW search parameter | 400 |
| p_timeout_ms | Query timeout in milliseconds | 9000 |

## Monitoring and Feedback

The search system includes components for monitoring and improvement:

### Performance Monitoring

- **search_performance_logs**: Records query performance metrics
- **embedding_metrics**: Tracks embedding generation performance
- **Log Analysis**: Regular review of timeout frequency and duration

### User Feedback

- **search_feedback**: Captures explicit user feedback on results
- **Implicit Signals**: Tracking user interactions with results
- **Feedback Loop**: Continuous improvement based on user feedback

### A/B Testing

- **Parameter Tuning**: Testing different weight and threshold settings
- **Model Comparison**: Evaluating different embedding models
- **Strategy Comparison**: Testing alternative search approaches

## Future Enhancements

Planned improvements to the search architecture:

1. **Query Understanding**:
   - Enhanced intent detection
   - Query expansion
   - Contextual understanding

2. **Ranking Improvements**:
   - Learning-to-rank models
   - Personalized ranking
   - Diversity-aware ranking

3. **Performance Optimizations**:
   - Distributed search architecture
   - Pre-computed partial results
   - Optimized caching strategies 