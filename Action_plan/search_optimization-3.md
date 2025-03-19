<think>The user wants a general solution that works for different types of posts - both those with informative titles and those with vague titles but detailed bodies. They want to make sure we're capturing context from both title and body to ensure we don't miss relevant posts that might answer a user's query.

Let me think about a comprehensive approach that addresses both scenarios:
1. Posts with clear titles but minimal bodies
2. Posts with vague titles but detailed bodies

This needs to be a general solution that works across different query types.</think># Universal Context-Aware Search Framework for Reddit Content

Instead of query-specific solutions, I'll outline a comprehensive approach that works for all search scenarios, addressing both clear titles (like "Indian food in SF") and vague titles with detailed bodies (like "Moving and need advice").

## 1. Content Understanding & Representation Enhancement

### A. Multi-Part Document Representation

```typescript
// Process each post as multiple related documents
function processPostForIndexing(post) {
  return {
    documents: [
      // Primary combined representation
      {
        id: `${post.id}_full`,
        content: `${post.title} ${post.selftext}`,
        type: 'full',
        metadata: extractMetadata(post.title, post.selftext)
      },
      // Title-focused representation
      {
        id: `${post.id}_title`,
        content: post.title,
        type: 'title',
        metadata: extractMetadata(post.title)
      },
      // Body-focused representation
      {
        id: `${post.id}_body`,
        content: post.selftext,
        type: 'body',
        metadata: extractMetadata(post.selftext)
      }
    ],
    // Store extracted entities for faster filtering
    entities: {
      topics: extractTopics(`${post.title} ${post.selftext}`),
      locations: extractLocations(`${post.title} ${post.selftext}`),
      intents: classifyIntents(`${post.title} ${post.selftext}`)
    }
  };
}
```

### B. Cross-Linked Metadata Extraction

```typescript
function extractMetadata(text) {
  return {
    entities: {
      locations: extractNamedEntities(text, 'LOCATION'),
      organizations: extractNamedEntities(text, 'ORGANIZATION'),
      concepts: extractConcepts(text)
    },
    sentiment: analyzeSentiment(text),
    questions: extractQuestions(text),
    topics: classifyTopics(text),
    keywords: extractKeywords(text)
  };
}
```

## 2. Enhanced Database Schema

```sql
-- Store posts with extracted metadata
CREATE TABLE enhanced_reddit_posts (
  id TEXT PRIMARY KEY,
  original_id TEXT REFERENCES reddit_posts(id),
  title TEXT NOT NULL,
  body TEXT,
  
  -- Extracted metadata
  topics TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  organizations TEXT[] DEFAULT '{}',
  named_entities JSONB DEFAULT '{}',
  question_types TEXT[] DEFAULT '{}',
  sentiment JSONB DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  
  -- Original post metadata
  subreddit TEXT NOT NULL,
  author_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  
  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED
);

-- Multi-representation embeddings table
CREATE TABLE post_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL REFERENCES enhanced_reddit_posts(id),
  representation_type TEXT NOT NULL, -- 'full', 'title', 'body'
  embedding VECTOR(1536),
  
  CONSTRAINT unique_post_representation UNIQUE (post_id, representation_type)
);

-- Create focused indexes
CREATE INDEX post_embeddings_full_idx ON post_embeddings
USING ivfflat (embedding vector_cosine_ops)
WHERE representation_type = 'full'
WITH (lists = 100);

CREATE INDEX post_embeddings_title_idx ON post_embeddings
USING ivfflat (embedding vector_cosine_ops)
WHERE representation_type = 'title'
WITH (lists = 100);

CREATE INDEX post_embeddings_body_idx ON post_embeddings
USING ivfflat (embedding vector_cosine_ops)
WHERE representation_type = 'body'
WITH (lists = 100);
```

## 3. Intelligent Query Analysis System

```typescript
function analyzeQuery(query) {
  // Extract query characteristics
  const entities = extractNamedEntities(query);
  const queryType = classifyQueryType(query);
  const queryTopics = extractTopics(query);
  const queryLocations = entities.filter(e => e.type === 'LOCATION').map(e => e.text);
  
  // Determine key search patterns
  const patterns = {
    isLocationBased: queryLocations.length > 0,
    isQuestionFormat: /\?$|\b(how|what|where|is|are|can|should|would)\b/i.test(query),
    isRecommendationSeeking: /\b(best|good|recommend|suggestion|advice)\b/i.test(query),
    mainTopic: queryTopics[0] || null
  };
  
  // Generate search strategies
  const strategies = [];
  
  if (patterns.isLocationBased) {
    strategies.push({
      type: 'location_focus',
      locations: queryLocations,
      weight: 1.2
    });
  }
  
  if (patterns.isRecommendationSeeking) {
    strategies.push({
      type: 'recommendation_focus',
      topics: queryTopics,
      weight: 1.1
    });
  }
  
  // Add default strategies
  strategies.push(
    { type: 'title_focus', weight: 1.0 },
    { type: 'body_focus', weight: 0.9 },
    { type: 'full_focus', weight: 0.8 }
  );
  
  return {
    entities,
    queryType,
    patterns,
    strategies,
    enhancedQueries: generateEnhancedQueries(query, patterns)
  };
}

function generateEnhancedQueries(baseQuery, patterns) {
  const enhanced = [baseQuery]; // Always include original query
  
  if (patterns.isLocationBased && patterns.mainTopic) {
    enhanced.push(`Information about ${patterns.mainTopic} in ${patterns.queryLocations.join(', ')}`);
  }
  
  if (patterns.isRecommendationSeeking) {
    enhanced.push(`Recommendations for ${baseQuery}`);
  }
  
  return enhanced;
}
```

## 4. Multi-Strategy Search Function

```sql
CREATE OR REPLACE FUNCTION multi_strategy_search(
  original_query TEXT,
  query_embedding VECTOR(1536),
  title_embedding VECTOR(1536),
  body_embedding VECTOR(1536),
  search_config JSONB,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  post_id TEXT,
  title TEXT,
  body_preview TEXT,
  subreddit TEXT,
  combined_score FLOAT,
  match_reasons TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  similarity_threshold FLOAT := 0.6;
  title_weight FLOAT := 1.0;
  body_weight FLOAT := 0.7;
  full_weight FLOAT := 0.9;
  location_boost FLOAT := 0.1;
  keyword_boost FLOAT := 0.05;
  locations TEXT[] := search_config->'locations';
  keywords TEXT[] := search_config->'keywords';
BEGIN
  RETURN QUERY
  
  WITH title_matches AS (
    -- Search against title representation
    SELECT 
      pe.post_id,
      1 - (pe.embedding <=> title_embedding) AS title_similarity
    FROM 
      post_embeddings pe
    WHERE 
      pe.representation_type = 'title' AND
      1 - (pe.embedding <=> title_embedding) > similarity_threshold
  ),
  
  body_matches AS (
    -- Search against body representation
    SELECT 
      pe.post_id,
      1 - (pe.embedding <=> body_embedding) AS body_similarity
    FROM 
      post_embeddings pe
    WHERE 
      pe.representation_type = 'body' AND
      1 - (pe.embedding <=> body_embedding) > similarity_threshold
  ),
  
  full_matches AS (
    -- Search against full representation
    SELECT 
      pe.post_id,
      1 - (pe.embedding <=> query_embedding) AS full_similarity
    FROM 
      post_embeddings pe
    WHERE 
      pe.representation_type = 'full' AND
      1 - (pe.embedding <=> query_embedding) > similarity_threshold
  ),
  
  combined_matches AS (
    -- Union all matches with their respective similarities
    SELECT 
      COALESCE(tm.post_id, bm.post_id, fm.post_id) AS post_id,
      COALESCE(tm.title_similarity, 0) * title_weight AS weighted_title_sim,
      COALESCE(bm.body_similarity, 0) * body_weight AS weighted_body_sim,
      COALESCE(fm.full_similarity, 0) * full_weight AS weighted_full_sim
    FROM 
      title_matches tm
    FULL OUTER JOIN 
      body_matches bm ON tm.post_id = bm.post_id
    FULL OUTER JOIN 
      full_matches fm ON COALESCE(tm.post_id, bm.post_id) = fm.post_id
  ),
  
  scored_matches AS (
    -- Calculate combined score and apply metadata boosts
    SELECT
      cm.post_id,
      p.title,
      p.body,
      p.subreddit,
      (cm.weighted_title_sim + cm.weighted_body_sim + cm.weighted_full_sim) +
      -- Location boost
      CASE WHEN cardinality(locations) > 0 AND 
                EXISTS (SELECT 1 FROM unnest(p.locations) l 
                        WHERE l = ANY(locations))
           THEN location_boost ELSE 0 END +
      -- Keyword boost
      CASE WHEN cardinality(keywords) > 0 AND 
                EXISTS (SELECT 1 FROM unnest(p.keywords) k 
                        WHERE k = ANY(keywords))
           THEN keyword_boost ELSE 0 END
      AS combined_score,
      
      -- Track match reasons for explainability
      ARRAY_REMOVE(ARRAY[
        CASE WHEN cm.weighted_title_sim > 0 THEN 'title_match' ELSE NULL END,
        CASE WHEN cm.weighted_body_sim > 0 THEN 'body_match' ELSE NULL END,
        CASE WHEN cm.weighted_full_sim > 0 THEN 'full_content_match' ELSE NULL END,
        CASE WHEN EXISTS (SELECT 1 FROM unnest(p.locations) l 
                         WHERE l = ANY(locations))
             THEN 'location_match' ELSE NULL END,
        CASE WHEN EXISTS (SELECT 1 FROM unnest(p.keywords) k 
                         WHERE k = ANY(keywords))
             THEN 'keyword_match' ELSE NULL END
      ], NULL) AS match_reasons
    FROM
      combined_matches cm
    JOIN
      enhanced_reddit_posts p ON cm.post_id = p.id
  )
  
  -- Return final results with preview text
  SELECT
    sm.post_id,
    sm.title,
    CASE 
      WHEN length(sm.body) > 200 
      THEN substring(sm.body, 1, 200) || '...'
      ELSE sm.body
    END AS body_preview,
    sm.subreddit,
    sm.combined_score,
    sm.match_reasons
  FROM
    scored_matches sm
  WHERE
    sm.combined_score > 0
  ORDER BY
    sm.combined_score DESC
  LIMIT
    max_results;
    
END;
$$;
```

## 5. Comment Context Integration

```typescript
async function getRelevantComments(postId, userQuery, queryAnalysis) {
  // Generate embedding for the user query
  const commentQueryEmbedding = await generateEmbedding(userQuery);
  
  // Find relevant comments within the post
  const { data: comments } = await supabase.rpc(
    'find_relevant_comments', 
    {
      parent_post_id: postId,
      query_embedding: commentQueryEmbedding,
      similarity_threshold: 0.6,
      max_comments: 5
    }
  );
  
  // For very few comments, include all
  if (comments.length <= 3) {
    return comments;
  }
  
  // For many comments, prioritize by relevance
  return comments.slice(0, 5);
}
```

## 6. Complete Search Flow

```typescript
async function universalSearch(userQuery) {
  // 1. Analyze the query
  const queryAnalysis = analyzeQuery(userQuery);
  
  // 2. Generate embeddings for different search strategies
  const embeddings = await generateQueryEmbeddings(userQuery, queryAnalysis);
  
  // 3. Prepare search configuration
  const searchConfig = {
    locations: queryAnalysis.entities.filter(e => e.type === 'LOCATION').map(e => e.text),
    keywords: extractKeywords(userQuery),
    queryType: queryAnalysis.queryType
  };
  
  // 4. Perform multi-strategy search
  const { data: posts, error } = await supabase.rpc(
    'multi_strategy_search',
    {
      original_query: userQuery,
      query_embedding: embeddings.full,
      title_embedding: embeddings.title,
      body_embedding: embeddings.body,
      search_config: searchConfig,
      max_results: 10
    }
  );
  
  if (error) throw error;
  
  // 5. For each post, find the most relevant comments
  const enhancedResults = await Promise.all(
    posts.map(async (post) => {
      const comments = await getRelevantComments(
        post.post_id, 
        userQuery,
        queryAnalysis
      );
      
      return {
        ...post,
        relevantComments: comments,
        matchExplanation: generateMatchExplanation(post, queryAnalysis)
      };
    })
  );
  
  // 6. Post-process results for presentation
  return {
    query: userQuery,
    queryAnalysis: {
      detectedEntities: queryAnalysis.entities,
      queryType: queryAnalysis.queryType,
      mainTopics: queryAnalysis.patterns.mainTopic
    },
    results: enhancedResults
  };
}
```

## 7. Content Preprocessing Pipeline

```typescript
// Process new Reddit content as it's added
async function processNewRedditContent(post) {
  // 1. Extract metadata
  const processedPost = processPostForIndexing(post);
  
  // 2. Store enhanced post data
  const { data: enhancedPost } = await supabase.from('enhanced_reddit_posts').insert({
    id: `post_${post.id}`,
    original_id: post.id,
    title: post.title,
    body: post.selftext,
    topics: processedPost.entities.topics,
    locations: processedPost.entities.locations,
    // ... other extracted metadata
    subreddit: post.subreddit,
    author_id: post.author_id,
    created_at: post.created_at
  }).select().single();
  
  // 3. Generate and store embeddings for each representation
  for (const doc of processedPost.documents) {
    const embedding = await generateEmbedding(doc.content);
    
    await supabase.from('post_embeddings').insert({
      post_id: enhancedPost.id,
      representation_type: doc.type,
      embedding
    });
  }
  
  // 4. Process comments (simplified version)
  await processCommentsForPost(post.id);
}
```

## 8. Implementation for Example Queries

### Example: "Best Indian food in SF"

```
Query Analysis:
- Topic: "Indian food"
- Location: "SF" (San Francisco)
- Intent: Recommendation
- Query Type: Location-based recommendation
- Enhanced Queries: 
  * "Best Indian food in SF"
  * "Recommendations for Indian food in San Francisco"

Search Strategies:
1. Location focus: Match posts with "SF", "San Francisco" in metadata
2. Title focus: Match post titles containing keywords
3. Body focus: Match post bodies discussing Indian food
4. Full content focus: Combined matching

Results:
- Post "Good Indian food in SF" matches on title (high score)
- Post "Hidden Gems in SF food scene" matches on body (medium score)
- Comments within these posts are ranked by relevance to the query
```

### Example: "Is it safe to stay near Presidio?"

```
Query Analysis:
- Topic: "safety"
- Location: "Presidio"
- Intent: Information seeking
- Query Type: Safety/location inquiry
- Enhanced Queries:
  * "Is it safe to stay near Presidio?"
  * "Information about safety in Presidio"

Search Strategies:
1. Location focus: Match posts with "Presidio" in metadata
2. Body focus: Match post bodies discussing safety
3. Title focus: Match posts with safety in titles
4. Full content focus: Combined matching

Results:
- Post "Moving and need advice!" scores highly despite vague title because:
  * Body contains "how safe is this area?" and "near Post and Presidio"
  * Location metadata matches "Presidio"
  * Body embedding captures safety concerns
- Relevant comments about neighborhood safety are extracted and ranked
```

## 9. Testing and Evaluation Framework

```typescript
const testQueries = [
  {
    query: "Best Indian food in SF",
    expectedTopics: ["food", "indian cuisine"],
    expectedLocations: ["SF", "San Francisco"],
    expectedIntent: "recommendation"
  },
  {
    query: "Is it safe to stay near Presidio?",
    expectedTopics: ["safety", "accommodation"],
    expectedLocations: ["Presidio"],
    expectedIntent: "safety_inquiry"
  },
  // Add more diverse test queries...
];

async function evaluateSearchSystem() {
  const results = [];
  
  for (const test of testQueries) {
    // Run analysis
    const analysis = analyzeQuery(test.query);
    
    // Check if analysis matches expectations
    const analysisScore = scoreAnalysis(analysis, test);
    
    // Run search
    const searchResults = await universalSearch(test.query);
    
    // Store evaluation results
    results.push({
      query: test.query,
      analysisScore,
      resultCount: searchResults.results.length,
      // More metrics...
    });
  }
  
  return generateEvaluationReport(results);
}
```

## Implementation Phases

### Phase 1: Enhanced Content Understanding (2-3 weeks)
- Implement metadata extraction for posts and comments
- Update database schema to store extracted entities
- Build query analysis components

### Phase 2: Multi-Representation Indexing (3-4 weeks)
- Implement multi-part document representation
- Create specialized embeddings for title, body, and full content
- Build cross-linking between related content

### Phase 3: Search & Retrieval Optimization (4-5 weeks)
- Implement multi-strategy search function
- Build comment relevance scoring and retrieval
- Optimize search parameters and weights

### Phase 4: Testing & Refinement (2-3 weeks)
- Create comprehensive test suite with diverse queries
- Evaluate performance across different query types
- Fine-tune parameters based on test results

## Benefits Over Current Approach

1. **Universal Coverage**: Works for all query types without special casing
2. **Content Flexibility**: Effectively handles both clear and vague titles
3. **Context Preservation**: Maintains relationship between posts and comments
4. **Explainable Results**: Provides reasoning for why content matched
5. **Adaptive Matching**: Different matching strategies based on query characteristics

This solution enables comprehensive searching across all Reddit content types, ensuring that relevant posts and comments are found regardless of where the matching context appears - title, body, or comments.
