
# Detailed Plan: Rebuild Content Representations with HNSW Indexes (512 dimensions)

## Phase 1: Schema Preparation

### Step 1: Create migration SQL script

```sql
-- Migration file: 20240403_rebuild_content_representations.sql

-- Backup current data if needed (optional)
CREATE TABLE IF NOT EXISTS content_representations_backup AS
SELECT * FROM content_representations;

-- Truncate the content_representations table to remove all existing data
TRUNCATE TABLE content_representations;

-- Update the vector dimension
ALTER TABLE content_representations 
ALTER COLUMN embedding TYPE VECTOR(512);

-- Drop existing IVFFlat indexes
DROP INDEX IF EXISTS content_representations_embedding_idx;
DROP INDEX IF EXISTS cr_basic_embedding_idx;
DROP INDEX IF EXISTS cr_title_embedding_idx;
DROP INDEX IF EXISTS cr_context_enhanced_embedding_idx;

-- Create new HNSW index for all representations
CREATE INDEX content_representations_embedding_hnsw_idx 
ON content_representations
USING hnsw (embedding vector_l2_ops)
WITH (m = 16, ef_construction = 128);

-- Create specialized representation type indexes
CREATE INDEX cr_title_embedding_hnsw_idx
ON content_representations
USING hnsw (embedding vector_l2_ops) 
WHERE representation_type = 'title'
WITH (m = 16, ef_construction = 128);

CREATE INDEX cr_context_enhanced_embedding_hnsw_idx
ON content_representations
USING hnsw (embedding vector_l2_ops) 
WHERE representation_type = 'context_enhanced'
WITH (m = 16, ef_construction = 128);

-- Update the store_content_representation function to only allow title and context_enhanced types
CREATE OR REPLACE FUNCTION store_content_representation(
  p_content_id TEXT,
  p_content_type TEXT,
  p_representation_type TEXT,
  p_embedding_vector VECTOR(512),
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Validate representation type
  IF p_representation_type NOT IN ('title', 'context_enhanced') THEN
    RAISE EXCEPTION 'Invalid representation type. Only "title" and "context_enhanced" are supported.';
  END IF;

  -- Insert or update the representation
  INSERT INTO content_representations (
    parent_id,
    content_type,
    representation_type,
    embedding,
    metadata
  )
  VALUES (
    p_content_id,
    p_content_type,
    p_representation_type,
    p_embedding_vector,
    p_metadata
  )
  ON CONFLICT (parent_id, content_type, representation_type)
  DO UPDATE SET
    embedding = p_embedding_vector,
    metadata = p_metadata,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Update refresh_content_representations procedure to only create title and context_enhanced
CREATE OR REPLACE FUNCTION refresh_content_representations(
  refresh_type TEXT DEFAULT 'all', -- 'all', 'posts', 'comments'
  batch_size INTEGER DEFAULT 100
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue posts for reprocessing
  IF refresh_type IN ('all', 'posts') THEN
    INSERT INTO embedding_queue (content_id, content_type, status, priority)
    SELECT 
      id, 
      'post', 
      'pending', 
      5 -- Higher priority
    FROM 
      reddit_posts
    WHERE 
      NOT EXISTS (
        SELECT 1 FROM content_representations 
        WHERE parent_id = id AND content_type = 'post' AND representation_type = 'context_enhanced'
      )
    LIMIT batch_size;
  END IF;
  
  -- Queue comments for reprocessing
  IF refresh_type IN ('all', 'comments') THEN
    INSERT INTO embedding_queue (content_id, content_type, status, priority)
    SELECT 
      id, 
      'comment', 
      'pending', 
      3 -- Lower priority than posts
    FROM 
      reddit_comments
    WHERE 
      NOT EXISTS (
        SELECT 1 FROM content_representations 
        WHERE parent_id = id AND content_type = 'comment' AND representation_type = 'context_enhanced'
      )
    LIMIT batch_size;
  END IF;
END;
$$;
```

## Phase 2: Update Embedding Generation Code

### Step 1: Modify the enhanced-embeddings/index.ts file

```typescript
// Update createEmbedding function to use 512 dimensions
async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
      dimensions: 512  // Change to 512 dimensions
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Update generateMultiRepresentationEmbeddings function to only generate title and context_enhanced
async function generateMultiRepresentationEmbeddings(
  content: any,
  contentType: 'post' | 'comment',
  threadContext: ThreadContext,
  extractedEntities: EntityExtractionResult,
  includeContext: boolean
): Promise<Record<string, { embedding: number[], metadata: Record<string, any> }>> {
  // Results object to store different embedding types with their metadata
  const embeddings: Record<string, { embedding: number[], metadata: Record<string, any> }> = {};
  
  try {
    // Common metadata for all representation types
    const entityMetadata = {
      topics: extractedEntities.topics,
      entities: extractedEntities.entities,
      locations: extractedEntities.locations,
      semanticTags: extractedEntities.semanticTags
    };
    
    // We're no longer generating basic embeddings
    
    // For posts, create title-specific embedding
    if (contentType === 'post' && content.title) {
      embeddings.title = {
        embedding: await createEmbedding(content.title),
        metadata: {
          type: 'title',
          length: content.title.length,
          tokenEstimate: Math.ceil(content.title.length / 4),
          ...entityMetadata  // Add entity data to metadata
        }
      };
    }
    
    // Context-enhanced embedding (for both posts and comments)
    // Create enhanced content with entity information and thread context
    let enhancedContent = '';
    
    if (contentType === 'post') {
      // For posts, create a simple enhanced representation
      enhancedContent = `Subreddit: r/${threadContext.subreddit || 'unknown'}
Title: ${content.title || ''}
Topics: ${extractedEntities.topics.join(', ')}
${extractedEntities.locations.length > 0 ? `Locations: ${extractedEntities.locations.join(', ')}` : ''}
${extractedEntities.semanticTags.length > 0 ? `Tags: ${extractedEntities.semanticTags.join(', ')}` : ''}
Content: ${content.content || ''}`;
    } else {
      // For comments, use our thread context utility
      enhancedContent = createThreadEnhancedInput(
        content.content || '',
        threadContext,
        {
          topics: extractedEntities.topics,
          locations: extractedEntities.locations,
          semanticTags: extractedEntities.semanticTags
        }
      );
    }
    
    // Create context-enhanced embedding
    embeddings.context_enhanced = {
      embedding: await createEmbedding(enhancedContent),
      metadata: {
        type: 'context_enhanced',
        length: enhancedContent.length,
        tokenEstimate: Math.ceil(enhancedContent.length / 4),
        thread_context: threadContext,
        ...entityMetadata  // Add entity data to metadata
      }
    };
    
    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return whatever embeddings we've generated so far
    return embeddings;
  }
}
```

## Phase 3: Update Database Queries for Search

### Step 1: Update vector search queries to use 512 dimensions

```sql
-- Create a helper function for generating query embeddings
CREATE OR REPLACE FUNCTION generate_query_embedding(
  query_text TEXT
)
RETURNS VECTOR(512)
LANGUAGE plpgsql
AS $$
DECLARE
  v_embedding VECTOR(512);
BEGIN
  -- Call your OpenAI embedding API here or use a stored procedure
  -- This is a placeholder - you'll need to implement the actual call
  -- v_embedding := result from your embedding API call
  
  RETURN v_embedding;
END;
$$;

-- Updated search function for HNSW indexes
CREATE OR REPLACE FUNCTION search_content(
  query_text TEXT,
  query_embedding VECTOR(512),
  filter_subreddit TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  content_id TEXT,
  content_type TEXT,
  similarity FLOAT,
  subreddit TEXT,
  title TEXT,
  content TEXT,
  topics TEXT[],
  locations TEXT[]
)
LANGUAGE sql
AS $$
  WITH representations AS (
    SELECT
      cr.parent_id,
      cr.content_type,
      cr.embedding <-> query_embedding AS distance,
      cr.metadata,
      CASE WHEN cr.content_type = 'post' THEN
        (SELECT subreddit FROM reddit_posts WHERE id = cr.parent_id)
      ELSE
        (SELECT p.subreddit FROM reddit_comments c
         JOIN reddit_posts p ON c.post_id = p.id
         WHERE c.id = cr.parent_id)
      END AS subreddit
    FROM
      content_representations cr
    WHERE
      cr.representation_type = 'context_enhanced'
      AND (filter_subreddit IS NULL OR
          (cr.content_type = 'post' AND
           EXISTS (SELECT 1 FROM reddit_posts WHERE id = cr.parent_id AND subreddit = filter_subreddit))
          OR
          (cr.content_type = 'comment' AND
           EXISTS (SELECT 1 FROM reddit_comments c
                   JOIN reddit_posts p ON c.post_id = p.id
                   WHERE c.id = cr.parent_id AND p.subreddit = filter_subreddit))
      )
    ORDER BY
      distance ASC
    LIMIT max_results
  )
  SELECT
    r.parent_id AS content_id,
    r.content_type,
    1 - r.distance AS similarity,
    r.subreddit,
    CASE WHEN r.content_type = 'post' THEN
      (SELECT title FROM reddit_posts WHERE id = r.parent_id)
    ELSE
      (SELECT p.title FROM reddit_comments c
       JOIN reddit_posts p ON c.post_id = p.id
       WHERE c.id = r.parent_id)
    END AS title,
    CASE WHEN r.content_type = 'post' THEN
      (SELECT content FROM reddit_posts WHERE id = r.parent_id)
    ELSE
      (SELECT content FROM reddit_comments WHERE id = r.parent_id)
    END AS content,
    (r.metadata->>'topics')::TEXT[] AS topics,
    (r.metadata->>'locations')::TEXT[] AS locations
  FROM
    representations r
  ORDER BY
    similarity DESC;
$$;
```

## Phase 4: Queue Data for Reprocessing

### Step a: Clear the queue and add all content

```sql
-- Clear the existing queue
TRUNCATE TABLE embedding_queue;

-- Queue all posts for reprocessing
INSERT INTO embedding_queue (content_id, content_type, status, priority)
SELECT 
  id, 
  'post', 
  'pending', 
  5 -- Higher priority
FROM 
  reddit_posts;

-- Queue all comments for reprocessing
INSERT INTO embedding_queue (content_id, content_type, status, priority)
SELECT 
  id, 
  'comment', 
  'pending', 
  3 -- Lower priority than posts
FROM 
  reddit_comments;
```

### Step 2: Process the queue in batches

Trigger the process-queue function to process items in batches. Consider increasing the batch size for faster processing, but monitor system performance.

## Phase 5: Monitoring and Validation

### Step 1: Monitor queue progress

```sql
-- Check queue status
SELECT 
  status, 
  COUNT(*) 
FROM 
  embedding_queue 
GROUP BY 
  status;

-- Check completion percentage
SELECT 
  ROUND(
    (SELECT COUNT(*) FROM embedding_queue WHERE status = 'completed') * 100.0 / 
    (SELECT COUNT(*) FROM embedding_queue)
  , 2) AS completion_percentage;
```

### Step 2: Validate embeddings and index performance

```sql
-- Check content_representations count by type
SELECT 
  representation_type, 
  COUNT(*) 
FROM 
  content_representations 
GROUP BY 
  representation_type;

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM search_content(
  'test query', 
  (SELECT embedding FROM content_representations LIMIT 1), -- placeholder
  NULL, 
  10
);
```

## Implementation Notes

1. No need to add new columns - we're keeping the existing table structure but changing the vector dimensions

2. We're focusing only on 'title' and 'context_enhanced' representation types

3. The HNSW index parameters (m=16, ef_construction=128) are reasonable starting points but may need tuning based on your specific data

4. You might want to process in smaller batches if you have a large dataset to avoid overwhelming the system

5. After completion, monitor query performance and adjust HNSW parameters if needed

Would you like me to elaborate on any specific part of this plan?
