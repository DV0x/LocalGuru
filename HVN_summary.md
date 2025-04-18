
# Search System Optimization Plan Summary

## Problem Identification
- Search system worked well with 1,500 records but began timing out after scaling to 21,000+ records
- PostgreSQL has an 8-second statement timeout constraint
- Current vector search implementation uses inefficient indexing for large datasets

## Current System Analysis
- Using IVFFlat vector indexes with 1536-dimensional embeddings (442MB total size, 225MB index)
- Each content item has three representation types:
  - basic (10,257 entries)
  - context_enhanced (10,257 entries)
  - title (620 entries)
- A chunking system exists (content_chunks table) but contains 0 records
- Enhanced embeddings are generated through OpenAI's embedding API

## Optimization Strategy
1. **Replace IVFFlat with HNSW indexes**
   - Better performance characteristics for approximate nearest neighbors search
   - Optimal parameters: m=24, ef_construction=100, ef_search=128
   - More efficient for both query time and memory usage

2. **Reduce vector dimensions**
   - Decrease from 1536 to 512 dimensions
   - 67% memory reduction with minimal accuracy impact
   - Switch to text-embedding-3-small model

3. **Implement hybrid search**
   - Combine PostgreSQL's text search (GIN indexes on tsvector columns) with vector search
   - Use text search as pre-filter to create candidate pool before vector similarity calculation
   - Weight results: 30% text score, 70% vector score

4. **Selective indexing**
   - Create specialized indexes only for most valuable representation types (title and context_enhanced)
   - Remove redundant index on basic embedding

## Implementation Plan
1. **Database Migrations**
   - Create HNSW indexes with reduced dimensions
   - Add tsvector columns with GIN indexes for text search
   - Implement hybrid search database function

2. **Edge Function Updates**
   - Modify enhanced-embeddings function to use smaller embedding dimensions
   - Update process-queue function to support dimension reduction

3. **Client-Side Integration**
   - Update search API endpoint to use new hybrid search function
   - Implement proper error handling and loading states

4. **Data Migration**
   - Create migration script to regenerate embeddings with reduced dimensions
   - Process in batches to avoid overloading the system

5. **Timeline and Testing**
   - 3-week implementation timeline with specific tasks for each phase
   - Includes testing and validation at each step
   - Performance monitoring and parameter tuning

This optimization approach addresses the core scaling issues while maintaining or improving search quality through the hybrid approach, promising significant performance improvements for the growing dataset.
