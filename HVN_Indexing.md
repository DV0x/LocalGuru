
# Implementation Plan for Search System Optimization

## 1. Database Migrations

### Step 1: Create HNSW Indexes with Reduced Dimensions
```sql
-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Migration for content_representations
ALTER TABLE content_representations 
DROP INDEX IF EXISTS content_representations_basic_embedding_idx,
DROP INDEX IF EXISTS content_representations_context_enhanced_embedding_idx,
DROP INDEX IF EXISTS content_representations_title_embedding_idx;

-- Add tsvector columns for text search
ALTER TABLE content_representations 
ADD COLUMN IF NOT EXISTS title_searchable tsvector GENERATED ALWAYS AS (to_tsvector('english', title)) STORED,
ADD COLUMN IF NOT EXISTS content_searchable tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN indexes for text search
CREATE INDEX IF NOT EXISTS content_representations_title_searchable_idx ON content_representations USING GIN (title_searchable);
CREATE INDEX IF NOT EXISTS content_representations_content_searchable_idx ON content_representations USING GIN (content_searchable);

-- Create HNSW indexes for vector search (only for most valuable representations)
CREATE INDEX IF NOT EXISTS content_representations_title_hnsw_idx ON content_representations 
USING hnsw (title_embedding vector_cosine_ops)
WITH (m=24, ef_construction=100, ef=128);

CREATE INDEX IF NOT EXISTS content_representations_context_enhanced_hnsw_idx ON content_representations 
USING hnsw (context_enhanced_embedding vector_cosine_ops)
WITH (m=24, ef_construction=100, ef=128);
```

### Step 2: Create New Database Functions for Hybrid Search

```sql
CREATE OR REPLACE FUNCTION search_content_hybrid(
  search_query TEXT,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 25,
  filter_params JSONB DEFAULT '{}'
) RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  title TEXT,
  content TEXT,
  similarity FLOAT,
  match_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  -- First perform text search to get candidate pool
  RETURN QUERY 
  WITH text_matches AS (
    SELECT 
      content_id,
      content_type,
      title,
      content,
      ts_rank(title_searchable, websearch_to_tsquery('english', search_query)) +
      ts_rank(content_searchable, websearch_to_tsquery('english', search_query)) AS text_score
    FROM 
      content_representations
    WHERE 
      (filter_params->>'content_type' IS NULL OR content_type = filter_params->>'content_type') AND
      (title_searchable @@ websearch_to_tsquery('english', search_query) OR
       content_searchable @@ websearch_to_tsquery('english', search_query))
    ORDER BY 
      text_score DESC
    LIMIT 100  -- Candidate pool size
  ),
  
  -- Generate embedding for the search query
  query_embedding AS (
    SELECT embedding_vector FROM generate_embedding(search_query)
  ),
  
  -- Calculate vector similarity for candidates
  vector_matches AS (
    SELECT 
      tm.content_id,
      tm.content_type,
      tm.title,
      tm.content,
      tm.text_score,
      -- Choose best match between title and context embeddings
      GREATEST(
        COALESCE(cr.title_embedding <=> (SELECT embedding_vector FROM query_embedding), 0),
        COALESCE(cr.context_enhanced_embedding <=> (SELECT embedding_vector FROM query_embedding), 0)
      ) AS vector_score
    FROM 
      text_matches tm
    JOIN 
      content_representations cr ON tm.content_id = cr.content_id
  ),
  
  -- Combine scores with weighted hybrid approach
  final_scores AS (
    SELECT 
      content_id,
      content_type,
      title,
      content,
      (0.3 * text_score + 0.7 * vector_score) AS similarity,
      CASE 
        WHEN text_score > vector_score THEN 'text_match'
        ELSE 'vector_match'
      END AS match_type
    FROM 
      vector_matches
    WHERE 
      vector_score >= match_threshold
    ORDER BY 
      similarity DESC
    LIMIT match_count
  )
  
  SELECT * FROM final_scores;
END;
$$;
```

## 2. Update Enhanced-Embeddings Function

```typescript
// Update enhanced-embeddings/index.ts

// Change OpenAI API calls to use 512-dimension embeddings
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small", // Use smaller model for 512 dimensions
  input: [contentToEmbed],
  dimensions: 512 // Explicitly set dimensions
});
```

## 3. Update Process-Queue Function

```typescript
// Update process-queue/index.ts

// Adjust embedding generation to use smaller dimensions
const enhancedEmbedResponse = await fetch(
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/enhanced-embeddings`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({
      contentId: job.record_id,
      contentType: contentType,
      includeContext: true,
      useDimensionReduction: true, // New parameter to enable dimension reduction
      embeddingDimensions: 512,    // Explicitly request 512 dimensions
      refreshRepresentations: true
    })
  }
);
```

## 4. Update Client-Side Search Implementation

```typescript
// Update search API endpoint (app/api/search/route.ts)

export async function POST(request: Request) {
  const { query, filters, limit = 25, threshold = 0.7 } = await request.json();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Use new hybrid search function
  const { data, error } = await supabase.rpc(
    'search_content_hybrid',
    {
      search_query: query,
      match_threshold: threshold,
      match_count: limit,
      filter_params: filters || {}
    }
  );
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json({ results: data });
}
```

## 5. Migration Script for Existing Data

```typescript
// migration-script.ts - Run via Deno or in an Edge Function

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const BATCH_SIZE = 100;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!
});

async function migrateAllContent() {
  // Get total count for progress tracking
  const { count } = await supabase
    .from('content_representations')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Found ${count} records to migrate`);
  
  let processedCount = 0;
  let currentOffset = 0;
  
  while (processedCount < count!) {
    // Get batch of records
    const { data, error } = await supabase
      .from('content_representations')
      .select('content_id, content_type, title, content')
      .range(currentOffset, currentOffset + BATCH_SIZE - 1);
    
    if (error || !data) {
      console.error('Error fetching records:', error);
      break;
    }
    
    // Process each record
    for (const record of data) {
      await regenerateEmbeddings(record);
      processedCount++;
      console.log(`Processed ${processedCount}/${count} (${Math.round(processedCount/count!*100)}%)`);
    }
    
    currentOffset += BATCH_SIZE;
  }
  
  console.log('Migration completed!');
}

async function regenerateEmbeddings(record: any) {
  try {
    // Generate new embeddings with reduced dimensions
    const titleEmbedding = await generateEmbedding(record.title, 512);
    const contentEmbedding = await generateEmbedding(record.content, 512);
    const contextEnhancedEmbedding = await generateContextEnhancedEmbedding(record, 512);
    
    // Update record with new embeddings
    const { error } = await supabase
      .from('content_representations')
      .update({
        title_embedding: titleEmbedding,
        basic_embedding: contentEmbedding,
        context_enhanced_embedding: contextEnhancedEmbedding
      })
      .eq('content_id', record.content_id);
    
    if (error) {
      console.error(`Error updating embeddings for ${record.content_id}:`, error);
    }
  } catch (error) {
    console.error(`Error regenerating embeddings for ${record.content_id}:`, error);
  }
}

async function generateEmbedding(text: string, dimensions: number) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [text],
    dimensions: dimensions
  });
  
  return embedding.data[0].embedding;
}

async function generateContextEnhancedEmbedding(record: any, dimensions: number) {
  // Logic to generate context-enhanced embedding
  const contextPrompt = `Title: ${record.title}\nContent: ${record.content}`;
  return generateEmbedding(contextPrompt, dimensions);
}

// Execute migration
migrateAllContent();
```

## 6. Implementation Timeline

1. **Week 1: Database Preparation (Days 1-3)**
   - Create SQL migration files
   - Test index creation on staging database
   - Implement basic text search indexes

2. **Week 1: Backend Updates (Days 4-7)**
   - Update enhanced-embeddings function for dimension reduction
   - Create hybrid search database function
   - Test backend changes with sample data

3. **Week 2: Data Migration (Days 8-12)**
   - Create and test migration script
   - Run migration on staging database
   - Validate search performance after migration
   - Optimize migration for production

4. **Week 2: Client Updates (Days 13-14)**
   - Update frontend search components to use new API
   - Implement proper error handling
   - Add loading states and pagination

5. **Week 3: Production Deployment (Days 15-18)**
   - Deploy database migrations
   - Run data migration in batches
   - Monitor system performance
   - Verify index efficiency

6. **Week 3: Performance Validation (Days 19-21)**
   - Stress test with high query volume
   - Fine-tune HNSW parameters if needed
   - Document performance improvements

Each step includes testing and validation to ensure the system works correctly before proceeding to the next phase.
