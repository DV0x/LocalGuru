<think>I see - it looks like I incorrectly identified query-analysis as missing when we already have it. Let me check what we have for query-analysis to correct this.</think>You're right, I need to correct my implementation plan. Let me verify what we already have for query analysis:

Ran tool
Let's look at the implementation to better understand what it does:

Read file: supabase/functions/query-analysis/index.ts

Read file: supabase/functions/query-analysis/index.ts
# Revised Implementation Plan for Localguru Data Pipeline

I've updated the implementation plan to account for the existing query analysis functionality. Let's focus on the gaps that need to be addressed:

## Phase 1: Data Representation Enhancement (1-2 weeks)

### 1.1 Content Representation Coverage
- **Generate embeddings for all content** 
  - Write a script to identify and queue all content without embeddings
  - Process them using the existing `embed` Edge Function
  - Target: 100% coverage for both posts and comments

### 1.2 Thread Context Integration
- **Transfer thread context to content representations**
  - Create a database function to extract thread context from `reddit_comments.thread_context`
  - Store this in the `metadata` JSONB field of `content_representations`
  - Create a scheduled job to keep these in sync
  ```sql
  CREATE OR REPLACE FUNCTION sync_thread_context_to_representations()
  RETURNS INTEGER AS $$
  DECLARE
    updated_count INTEGER := 0;
  BEGIN
    -- Update content_representations with thread context from reddit_comments
    UPDATE public.content_representations cr
    SET metadata = jsonb_build_object(
      'thread_context', rc.thread_context::jsonb,
      'depth', rc.depth,
      'parent_id', rc.parent_id
    )
    FROM public.reddit_comments rc
    WHERE cr.parent_id = rc.id
    AND cr.content_type = 'comment'
    AND (cr.metadata IS NULL OR cr.metadata->>'thread_context' IS NULL)
    AND rc.thread_context IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
  END;
  $$ LANGUAGE plpgsql;
  ```

### 1.3 Enhanced Embeddings Reprocessing
- **Update enhanced-embeddings Edge Function**
  - Modify to incorporate thread context and metadata in embedding generation
  - Reprocess all content with context-enhanced representations
  - Ensure chunked content is processed for all long posts

## Phase 2: Search Infrastructure Improvement (2-3 weeks)

### 2.1 Integrate Query Analysis with Parallel Search
- **Create integrated search API**
  - Connect existing query-analysis Edge Function with parallel_search
  - Use entity detection to customize search parameters
  - Apply intent recognition to search strategy selection
  ```typescript
  // app/api/intelligent-search/route.ts
  export async function GET(request: NextRequest) {
    // Extract query from request
    // Send to query-analysis Edge Function
    // Use analysis to customize search parameters
    // Call parallel_search with optimized parameters
    // Return enriched results
  }
  ```

### 2.2 Parallel Search Implementation
- **Replace search_content_representations with parallel_search**
  - Update API routes to use the existing parallel_search function
  - Implement proper parameter handling for multiple strategies
  - Support configurable weights for different representation types
  ```typescript
  // Example parallel_search call
  const { data, error } = await supabase.rpc('parallel_search', {
    search_query: query,
    query_embedding: embedding,
    similarity_threshold_docs: 0.65,
    similarity_threshold_chunks: 0.7,
    docs_weight: 0.8,
    max_results: limit
  });
  ```

### 2.3 Result Enrichment Pipeline
- **Create a result enrichment function**
  - Add entity information from `extracted_entities`
  - Include thread context for comments
  - Add related content links
  - Implement highlighting of matched terms

## Phase 3: Frontend and User Experience (2 weeks)

### 3.1 Enhanced Search UI
- **Upgrade test-search page**
  - Add controls for search strategies and parameters
  - Display enriched results with context
  - Include thread visualization for comments
  - Show entity and topic information

### 3.2 Feedback Collection Implementation
- **Activate feedback collection**
  - Implement UI components for feedback
  - Connect to existing feedback Edge Function
  - Store in `search_feedback` table
  - Track user interactions with results

### 3.3 Results Display Optimization
- **Implement advanced results display**
  - Format relevant snippets with context
  - Highlight key entities and matched terms
  - Provide thread context visualization for comments
  - Show related content suggestions

## Phase 4: Metrics and Optimization (1-2 weeks)

### 4.1 Search Performance Metrics
- **Implement metrics dashboard**
  - Connect to existing `embedding_metrics` table
  - Track search latency, result quality, and user engagement
  - Create visualization of search effectiveness

### 4.2 Continuous Improvement Process
- **Establish automated improvement workflows**
  - Use feedback data to identify problematic searches
  - Reprocess content with poor performance
  - Adjust search parameters based on metrics

### 4.3 A/B Testing Framework
- **Implement search strategy testing**
  - Compare different embedding approaches
  - Test various threshold and weight configurations
  - Measure impact on search quality metrics

## Phase 5: Advanced Features (2-3 weeks)

### 5.1 Multi-strategy Search Optimization
- **Fine-tune parallel search implementation**
  - Optimize weights between different representation types
  - Create specialized strategies for different query intents
  - Implement adaptive thresholds based on query complexity

### 5.2 Contextual Boosts
- **Implement metadata-based boosting**
  - Boost results based on entity matches
  - Increase relevance of results with thread context matches
  - Apply recency and popularity factors

### 5.3 Content Diversity
- **Add result diversity mechanisms**
  - Ensure representation of different viewpoints
  - Balance between different content types
  - Avoid excessive similar results

## Implementation Schedule

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | 1.1, 1.2 | Full embedding coverage, thread context integration |
| 2 | 1.3, 2.1 | Enhanced embeddings, integrated search API |
| 3 | 2.2, 2.3 | Parallel search implementation, result enrichment |
| 4 | 3.1, 3.2 | Enhanced search UI, feedback collection |
| 5 | 3.3, 4.1 | Results display optimization, metrics dashboard |
| 6 | 4.2, 4.3 | Continuous improvement process, A/B testing |
| 7-8 | 5.1, 5.2 | Multi-strategy optimization, contextual boosts |
| 9 | 5.3, Final Testing | Content diversity, system optimization |

## Implementation Priorities

1. **First Priority**: Fix the data representation gaps
   - Complete embedding coverage for all content
   - Transfer thread context to content representations
   - This provides the foundation for everything else

2. **Second Priority**: Utilize parallel_search
   - Replace search_content_representations with parallel_search
   - Integrate query analysis with search parameters
   - Apply result enrichment

3. **Third Priority**: User experience and feedback
   - Enhance result display
   - Implement feedback collection
   - Create comprehensive metrics

## Technical Requirements

- **Database**: Ensure proper indexing for vector searches
- **Edge Functions**: Optimize for performance and reliability
- **Frontend**: Use React Server Components where appropriate
- **Metrics**: Implement logging and monitoring

## Success Criteria

- **Search Precision**: >80% relevant results in top 5
- **Search Recall**: Ability to find content across posts and comments
- **Performance**: <1.5s average search response time
- **Coverage**: 100% of content with appropriate representations
- **User Satisfaction**: Positive feedback on >75% of searches

This revised plan acknowledges the existing query analysis functionality and focuses on integrating it with the parallel search implementation, while addressing the key gaps in data representation and result enrichment.
