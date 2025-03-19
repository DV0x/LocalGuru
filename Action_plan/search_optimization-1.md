<think>The user is asking about optimizing their Reddit data search system to improve context-aware results. They've provided examples of Reddit posts about topics like Indian food in SF, activism for environmental regulations, and favorite public libraries. They want to understand how to improve their vector search so that when a user asks a question like "best Indian food in SF", the system provides results that understand the post context and returns the most relevant comments.

Let me first examine what data structures they have in their database by searching for the Reddit table schemas.</think>Let me examine the current database structure for Reddit content to understand how we can optimize search with better context.

Ran tool
Let's look at the detailed structure of the reddit_posts and reddit_comments tables:

Read file: supabase/migrations/20240302120100_create_reddit_posts_table.sql

Read file: supabase/migrations/20240302120200_create_reddit_comments_table.sql
Let's also look at the content_chunks table to understand how chunks are stored:

Ran tool

Read file: supabase/migrations/20240309000000_content_chunks.sql
Now, let me check the parallel_search function to understand how the search currently works:

Read file: supabase/migrations/20250307030000_fix_chunk_id_type.sql
Let's also check the search Edge Function to see how embeddings are generated:

Read file: supabase/functions/search/index.ts
# Optimizing Reddit Content Search for Contextual Relevance

Based on my analysis of your database structure and search implementation, here's how to optimize your vector search to better understand post context and provide more relevant results for queries like "best Indian food in SF":

## Current System Analysis

Your system has:
1. **Three primary tables**: `reddit_posts`, `reddit_comments`, and `content_chunks`
2. **Vector embeddings**: 1536-dimensional vectors using OpenAI's text-embedding-3-small model
3. **Parallel search**: Searches across posts, comments, and chunks independently
4. **Basic contextual linking**: Comments include post_id and parent_id for hierarchical relationships

## Key Optimization Strategies

### 1. Context-Enhanced Embeddings

Current embeddings are generated individually for posts and comments. To improve context awareness:

```typescript
// Enhanced embedding generation
async function generateContextualEmbedding(content, type, contextInfo) {
  let enhancedContent = '';
  
  if (type === 'comment') {
    // Add post title and relevant parent comment context
    enhancedContent = `Post: ${contextInfo.postTitle}\n`;
    
    if (contextInfo.parentComment) {
      enhancedContent += `In response to: ${contextInfo.parentComment.substring(0, 100)}...\n`;
    }
    
    enhancedContent += `Comment: ${content}`;
  } else {
    // For posts, enhance with subreddit context
    enhancedContent = `Subreddit: r/${contextInfo.subreddit}\n`;
    enhancedContent += `Post title: ${contextInfo.title}\n`;
    enhancedContent += `Content: ${content}`;
  }
  
  // Generate embedding with the enhanced content
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: enhancedContent,
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}
```

### 2. Hierarchical Chunk Storage

```sql
-- Update content_chunks table to include better context
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS 
  post_title TEXT;
  
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS
  thread_path TEXT[]; -- Store the conversation path for comment chunks
  
-- Update embedding function to include thread context
CREATE OR REPLACE FUNCTION update_comment_chunk_embeddings(comment_id TEXT)
RETURNS VOID AS $$
DECLARE
  comment_record RECORD;
  post_record RECORD;
  parent_path TEXT[];
  context_text TEXT;
BEGIN
  -- Get comment and related post
  SELECT c.*, p.title AS post_title, p.id AS post_id
  FROM reddit_comments c
  JOIN reddit_posts p ON c.post_id = p.id
  WHERE c.id = comment_id
  INTO comment_record;
  
  -- Build contextual information including thread path
  SELECT array_agg(c.content ORDER BY c.depth) 
  FROM reddit_comments c
  WHERE c.id = ANY(comment_record.path)
  INTO parent_path;
  
  -- Create context-aware chunks with thread information
  FOR i IN 1..ceil(length(comment_record.content)/500) LOOP
    -- Add chunk with context
    INSERT INTO content_chunks (
      parent_id,
      content_type,
      chunk_index,
      chunk_text,
      post_title,
      thread_path
    ) VALUES (
      comment_id,
      'comment',
      i,
      substring(comment_record.content FROM ((i-1)*500+1) FOR 500),
      comment_record.post_title,
      parent_path
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 3. Query Context Detection

Implement query understanding to identify the context of the search:

```typescript
function detectQueryContext(query) {
  // Detect location mentions
  const locationMatches = query.match(/in\s+([A-Za-z\s]+)|\b([A-Za-z]+\s+area)\b/gi);
  
  // Detect topic/entity mentions
  const topics = extractEntities(query);
  
  // Detect query intent (recommendation, factual, etc.)
  const intent = classifyQueryIntent(query);
  
  return {
    locations: locationMatches || [],
    topics,
    intent,
    enhancedQuery: `Find information about ${topics.join(', ')} in ${locationMatches?.join(', ') || 'any location'}`
  };
}
```

### 4. Modified Search Function with Context Awareness

```sql
CREATE OR REPLACE FUNCTION context_aware_search(
  search_query TEXT,
  query_embedding public.vector(1536),
  query_context JSONB,
  similarity_threshold DOUBLE PRECISION DEFAULT 0.65,
  max_results INTEGER DEFAULT 15
)
RETURNS TABLE (
  id TEXT,
  content_type TEXT,
  title TEXT,
  similarity DOUBLE PRECISION,
  text_preview TEXT,
  post_id TEXT,
  subreddit TEXT,
  thread_context TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  
  -- First search for the most relevant content chunks
  WITH relevant_chunks AS (
    SELECT
      ck.id,
      ck.parent_id,
      ck.content_type,
      ck.chunk_text,
      1 - (ck.embedding <=> query_embedding) AS base_similarity,
      
      -- Boost score based on subreddit match
      CASE WHEN p.subreddit = query_context->>'location' 
           THEN 0.1 ELSE 0 END AS location_boost,
           
      -- Boost based on thread context relevance
      CASE WHEN ck.thread_path IS NOT NULL 
           THEN 0.05 ELSE 0 END AS context_boost
           
    FROM content_chunks ck
    LEFT JOIN reddit_comments c ON ck.parent_id = c.id AND ck.content_type = 'comment'
    LEFT JOIN reddit_posts p ON 
      (ck.content_type = 'post' AND ck.parent_id = p.id) OR
      (ck.content_type = 'comment' AND c.post_id = p.id)
    WHERE 1 - (ck.embedding <=> query_embedding) > similarity_threshold
  ),
  
  -- Calculate final scores with boosts
  scored_chunks AS (
    SELECT
      id,
      parent_id,
      content_type,
      chunk_text,
      (base_similarity + location_boost + context_boost) AS similarity
    FROM relevant_chunks
    ORDER BY similarity DESC
    LIMIT 100
  ),
  
  -- Group by parent to avoid fragmentation
  grouped_results AS (
    SELECT
      parent_id,
      content_type,
      MAX(similarity) AS max_similarity,
      array_agg(chunk_text ORDER BY similarity DESC) AS context_snippets
    FROM scored_chunks
    GROUP BY parent_id, content_type
  )
  
  -- Get full results with context
  SELECT
    g.parent_id AS id,
    g.content_type,
    COALESCE(p.title, 'Comment') AS title,
    g.max_similarity AS similarity,
    CASE 
      WHEN g.content_type = 'post' THEN substring(p.content, 1, 200)
      ELSE substring(c.content, 1, 200)
    END AS text_preview,
    COALESCE(c.post_id, p.id) AS post_id,
    p.subreddit,
    g.context_snippets AS thread_context
  FROM grouped_results g
  LEFT JOIN reddit_comments c ON g.content_type = 'comment' AND g.parent_id = c.id
  LEFT JOIN reddit_posts p ON 
    (g.content_type = 'post' AND g.parent_id = p.id) OR
    (g.content_type = 'comment' AND c.post_id = p.id)
  ORDER BY similarity DESC
  LIMIT max_results;
  
END;
$$;
```

### 5. Semantic Grouping of Results

Implement post-processing to group results by their conversation thread:

```typescript
function organizeSearchResultsByThread(results) {
  const postGroups = {};
  
  // Group by post
  results.forEach(result => {
    const postId = result.post_id;
    
    if (!postGroups[postId]) {
      postGroups[postId] = {
        post: null,
        comments: [],
        maxSimilarity: 0,
        title: result.title
      };
    }
    
    // Track highest similarity score
    if (result.similarity > postGroups[postId].maxSimilarity) {
      postGroups[postId].maxSimilarity = result.similarity;
    }
    
    // Add to appropriate category
    if (result.content_type === 'post' || result.content_type === 'post_chunk') {
      postGroups[postId].post = result;
    } else {
      postGroups[postId].comments.push(result);
    }
  });
  
  // Sort groups by max similarity
  return Object.values(postGroups)
    .sort((a, b) => b.maxSimilarity - a.maxSimilarity);
}
```

### 6. Contextual Metadata Boosting

Add relevance boosts based on location and topic matches:

```sql
-- Add field for location entities extracted from text
ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS
  extracted_locations TEXT[];
  
ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS
  extracted_locations TEXT[];

-- Update search function to use metadata
CREATE OR REPLACE FUNCTION boost_by_metadata(
  result_id TEXT,
  result_type TEXT,
  query_context JSONB
) RETURNS FLOAT AS $$
DECLARE
  boost FLOAT := 0;
  locations TEXT[];
BEGIN
  -- Get location metadata
  IF result_type = 'post' THEN
    SELECT extracted_locations INTO locations
    FROM reddit_posts
    WHERE id = result_id;
  ELSE
    SELECT extracted_locations INTO locations
    FROM reddit_comments
    WHERE id = result_id;
  END IF;
  
  -- Apply location boost
  IF query_context->>'location' IS NOT NULL AND 
     query_context->>'location' = ANY(locations) THEN
    boost := boost + 0.15;
  END IF;
  
  RETURN boost;
END;
$$ LANGUAGE plpgsql;
```

### 7. Conversation-Aware Embedding Generation Pipeline

Create a preprocessing pipeline that embeds with conversation context:

```typescript
async function processRedditThread(postId) {
  // Fetch post and all comments
  const post = await fetchPost(postId);
  const comments = await fetchComments(postId);
  
  // Build conversation tree
  const commentTree = buildCommentTree(comments);
  
  // Process post with its own context
  await embedPostWithContext(post);
  
  // Process comments with thread context
  for (const comment of comments) {
    const threadContext = getThreadContext(comment, commentTree, post);
    await embedCommentWithContext(comment, threadContext);
  }
}

function getThreadContext(comment, commentTree, post) {
  // Extract conversation path leading to this comment
  const ancestors = [];
  let currentId = comment.parent_id;
  
  while (currentId && currentId !== post.id) {
    const parent = commentTree.find(c => c.id === currentId);
    if (parent) {
      ancestors.unshift({
        id: parent.id,
        content: parent.content.substring(0, 150) // Truncate for context
      });
      currentId = parent.parent_id;
    } else {
      break;
    }
  }
  
  return {
    post: {
      id: post.id,
      title: post.title,
      content: post.content?.substring(0, 200) || ""
    },
    ancestors
  };
}
```

## Implementation Plan for Indian Food in SF Example

For a query like "best Indian food in SF":

1. **Enhanced Preprocessing**:
   - Extract "Indian food" as the topic entity
   - Extract "SF" as the location entity
   - Classify as a recommendation request
   - Rewrite query as "Find recommendations for the best Indian food restaurants in San Francisco"

2. **Context-Aware Search**:
   - Apply location boost for comments/posts mentioning San Francisco
   - Apply topic boost for content related to Indian cuisine
   - Prioritize comments with recommendation language patterns
   - Group results by conversation thread

3. **Result Organization**:
   - Group by post threads about Indian food in SF
   - Present top comments from each relevant thread
   - Include post title and context for each comment
   - Sort within each thread by relevance

## Expected Result Format

```json
{
  "query": "best Indian food in SF",
  "interpreted_as": {
    "topic": "Indian food",
    "location": "San Francisco",
    "intent": "recommendation"
  },
  "conversation_threads": [
    {
      "post_title": "Good Indian food in SF",
      "post_id": "1izwr16",
      "subreddit": "AskSF",
      "thread_relevance": 0.92,
      "top_comments": [
        {
          "content": "Amber India in SoMa is fantastic, great butter chicken and naan...",
          "similarity": 0.88,
          "author": "user123",
          "context": "In response to: 'Looking for good Indian food in SF'"
        },
        {
          "content": "Dosa on Valencia has amazing South Indian food and great atmosphere...",
          "similarity": 0.85,
          "author": "user456"
        }
      ]
    },
    {
      "post_title": "Hidden Gems in SF food scene",
      "post_id": "abc123",
      "subreddit": "AskSF",
      "thread_relevance": 0.78,
      "top_comments": [
        {
          "content": "For Indian food, check out Shalimar in the Tenderloin. Amazing authentic North Indian...",
          "similarity": 0.79,
          "author": "user789"
        }
      ]
    }
  ]
}
```

These optimizations will make your search significantly more context-aware and better at handling specific queries like "best Indian food in SF" by understanding both the content and the conversation structure of your Reddit data.
