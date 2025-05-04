# Two-Phase Retrieval Approach for Hybrid Search

## Overview

The two-phase retrieval approach is an optimization technique for search systems that combines vector similarity search with traditional text search to deliver better results with improved latency. This document explains how this approach works in our `comment_only_search_with_timeout` function and why it enhances both performance and result quality.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT SEARCH QUERY                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       QUERY PROCESSING                           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │ Text Query      │    │ Query Embedding │    │ Parameters  │  │
│  │ (p_query)       │    │ (vector)        │    │ & Weights   │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: CANDIDATE RETRIEVAL (Creating Temporary Table)         │
│                                                                 │
│  ┌─────────────────────────────┐    ┌─────────────────────────┐ │
│  │ Vector Similarity Search    │    │ Text Search             │ │
│  │ -------------------------   │    │ -------------------     │ │
│  │ • Lower threshold (0.5x)    │    │ • websearch_to_tsquery  │ │
│  │ • Uses HNSW index           │    │ • Faster retrieval      │ │
│  │ • p_max_results × 2 items   │    │ • Complementary matches │ │
│  └─────────────────────────────┘    └─────────────────────────┘ │
│                  │                               │              │
│                  └───────────────┬───────────────┘              │
│                                  │                              │
│                                  ▼                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TEMP TABLE: search_candidates              │   │
│  │              (Combined Result Pool)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: RE-RANKING                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Hybrid Scoring Formula                                   │   │
│  │ -----------------------                                  │   │
│  │ • Combined vector + text scores                          │   │
│  │ • Weighted by p_vector_weight and p_text_weight          │   │
│  │ • Applied only to candidate pool                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                  │                              │
│                                  ▼                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Sort by Final Score & Limit to p_max_results            │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TIMEOUT HANDLING                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ If timeout occurs during processing:                     │   │
│  │ • Fall back to text-only search                          │   │
│  │ • Return results with timed_out = TRUE                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RETURN FINAL RESULTS                        │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Explanation

### Phase 1: Candidate Retrieval

In the first phase, we cast a wider net to gather potential matches using two complementary approaches:

1. **Vector Similarity Search**:
   - Uses the pre-computed embeddings stored in `content_representations` table
   - Applies a relaxed similarity threshold (50% of the final threshold)
   - Leverages HNSW (Hierarchical Navigable Small World) indexes for fast approximate nearest neighbor search
   - Retrieves twice as many results as ultimately needed (p_max_results * 2)
   - Parameters like `ef_search = 400` control the quality vs. speed tradeoff

2. **Text Search**:
   - Uses PostgreSQL's full-text search capabilities via `websearch_to_tsquery`
   - Searches against the pre-indexed `search_vector` column
   - Captures results that may not be semantically similar but contain exact keyword matches
   - Complements the vector search results for better coverage

Both result sets are combined into a temporary table (`search_candidates`), removing duplicates and preserving the vector similarity scores for later use.

### Phase 2: Re-Ranking

The second phase applies a more sophisticated scoring algorithm to the candidate pool:

1. **Hybrid Scoring Formula**:
   ```sql
   (sc.vector_similarity * p_vector_weight + 
    COALESCE(ts_rank_cd(sc.search_vector, websearch_to_tsquery('english', p_query)), 0) * p_text_weight)::FLOAT AS similarity
   ```

2. **Benefits of Re-Ranking**:
   - Balances semantic similarity with keyword relevance
   - Applies weights to favor either vector or text matches based on configuration
   - Performs complex scoring only on the candidate pool (much smaller than the entire database)
   - Produces a final, well-ordered result set limited to exactly p_max_results

### Timeout Handling

The function implements robust timeout handling:

1. **Statement Timeout**:
   - Sets a database query timeout (default: 9000ms)
   - Prevents long-running queries from affecting application performance

2. **Fallback Strategy**:
   - If the full hybrid search times out, falls back to text-only search
   - Text search is significantly faster but may be less semantically relevant
   - Returns results with `timed_out = TRUE` flag to inform the client

## Performance Benefits

The two-phase approach offers several key performance advantages:

1. **Reduced Computational Load**:
   - Complex scoring is only applied to the candidate pool (p_max_results * 2)
   - Avoids expensive calculations on the entire dataset

2. **Better Index Utilization**:
   - HNSW vector indexes are optimized for retrieving approximate neighbors
   - The increased `ef_search` parameter improves recall while maintaining reasonable search times

3. **Memory Efficiency**:
   - The temporary table materializes intermediate results once
   - Prevents redundant computations and facilitates caching

4. **Optimal Use of Database Resources**:
   - Vector search is efficient but CPU-intensive
   - Text search is fast but less semantically aware
   - Combining both optimizes the resource usage

5. **Scalability**:
   - The approach scales better with increasing database size
   - Works well with the increased result limit (50 vs. previously 20)

## Parameter Tuning

The function's behavior can be tuned through several parameters:

| Parameter          | Default | Description                                         |
|--------------------|---------|-----------------------------------------------------|
| p_max_results      | 50      | Maximum number of results to return                 |
| p_match_threshold  | 0.4     | Minimum similarity score for matches                |
| p_vector_weight    | 0.7     | Weight given to vector similarity in final score    |
| p_text_weight      | 0.3     | Weight given to text relevance in final score       |
| p_ef_search        | 400     | HNSW parameter controlling search quality vs. speed |
| p_timeout_ms       | 9000    | Maximum execution time before fallback              |

## Conclusion

The two-phase retrieval approach represents a significant improvement in our search architecture by:

1. **Enhancing result quality** through better semantic understanding and keyword coverage
2. **Improving latency** by optimizing the search process and computational resources
3. **Providing resilience** through graceful fallback when facing timeouts
4. **Offering tunability** through configurable parameters for different use cases

This approach is particularly valuable for our application where both search quality and performance are critical requirements. 