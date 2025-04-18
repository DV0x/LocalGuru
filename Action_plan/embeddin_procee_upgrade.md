
Good catch! You've identified an important gap in our implementation.

In the current implementation, the thread context for comments includes:
- Post ID
- Post Title
- Subreddit
- Parent comments (with their content)
- Path information

But we're **not** including the original post content as part of the thread context.

This is a missed opportunity for better contextual understanding. Here's how we should modify the thread context building to include post content:

```typescript
// src/services/thread-context.ts - Updated buildThreadContext function

export function buildThreadContext(
  commentId: string,
  post: {
    id: string;
    title: string;
    subreddit: string;
    content?: string; // Add content field
  },
  parentComments: ParentComment[]
): ThreadContext {
  // Sort parent comments by ID to ensure correct order
  const sortedParents = [...parentComments].sort((a, b) => a.id.localeCompare(b.id));
  
  return {
    postId: post.id,
    postTitle: post.title,
    postContent: post.content, // Include post content!
    subreddit: post.subreddit,
    path: sortedParents.map(p => p.id),
    depth: sortedParents.length,
    parent_comments: sortedParents,
    summary: ''
  };
}
```

And when we fetch the post data:

```typescript
// Updated in content-processor.ts

// When processing a comment, fetch the post with content
const { data: comment, error } = await supabase
  .from('reddit_comments')
  .select(`id, content, post_id, parent_id, path, 
          post:post_id (id, title, content, subreddit)`) // Include post content
  .eq('id', contentId)
  .single();

// When building thread context, include post content
threadContext = buildThreadContext(
  comment.id,
  {
    id: comment.post_id,
    title: comment.post?.title || '',
    content: comment.post?.content || '', // Include post content
    subreddit: comment.post?.subreddit || ''
  },
  parents as ParentComment[]
);
```

And update the `createThreadEnhancedInput` function to include post content in the enhanced representation:

```typescript
export function createThreadEnhancedInput(
  commentContent: string,
  threadContext: ThreadContext,
  entityTags: EntityTags
): string {
  let enhancedContent = `Subreddit: r/${threadContext.subreddit || 'unknown'}
Post Title: ${threadContext.postTitle || ''}`;

  // Add post content if available (truncated if very long)
  if (threadContext.postContent) {
    const truncatedPostContent = threadContext.postContent.length > 500 
      ? threadContext.postContent.substring(0, 500) + '...' 
      : threadContext.postContent;
    enhancedContent += `\nPost Content: ${truncatedPostContent}`;
  }
  
  // Rest of the function remains the same...
```

This will significantly improve the contextual understanding of comments by including the original post content they're responding to in the embeddings.


##Search vector

You've identified an important gap in our implementation plan! We didn't explicitly address updating the `search_vector` columns in the `reddit_posts` and `reddit_comments` tables.

To fully leverage our AI-extracted metadata in BM25 keyword searches, we need to update those search vectors. Here's how we should add this to our implementation:

```typescript
// In content-processor.ts, after updating metadata

// For posts - update search_vector with AI-extracted metadata
if (contentType === 'post') {
  // First update the metadata fields
  await supabase
    .from('reddit_posts')
    .update({
      extracted_entities: extractedEntities.entities,
      extracted_topics: extractedEntities.topics,
      extracted_locations: extractedEntities.locations,
      semantic_tags: extractedEntities.semanticTags
    })
    .eq('id', contentId);
    
  // Then update the search_vector column using SQL
  await supabase.rpc('update_post_search_vector', { post_id: contentId });
} 
// For comments
else {
  // First update the metadata fields
  const threadContextJSON = {
    postTitle: threadContext.postTitle,
    subreddit: threadContext.subreddit,
    parentId: threadContext.parentId,
    path: threadContext.path,
    depth: threadContext.depth,
    summary: threadContext.summary
  };
  
  await supabase
    .from('reddit_comments')
    .update({
      extracted_entities: extractedEntities.entities,
      extracted_topics: extractedEntities.topics,
      thread_context: threadContextJSON,
    })
    .eq('id', contentId);
    
  // Then update the search_vector column using SQL
  await supabase.rpc('update_comment_search_vector', { comment_id: contentId });
}
```

We need to create these two database functions:

```sql
-- Function to update post search_vector
CREATE OR REPLACE FUNCTION update_post_search_vector(post_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE reddit_posts
  SET search_vector = 
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(extracted_topics, ' '), '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(semantic_tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(extracted_locations, ' '), '')), 'B') ||
    setweight(to_tsvector('english', 
      coalesce(jsonb_to_text(extracted_entities), '')), 'C')
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update comment search_vector
CREATE OR REPLACE FUNCTION update_comment_search_vector(comment_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE reddit_comments
  SET search_vector = 
    setweight(to_tsvector('english', coalesce(content, '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(extracted_topics, ' '), '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(jsonb_to_text(thread_context), '')), 'B') ||
    setweight(to_tsvector('english', 
      coalesce(jsonb_to_text(extracted_entities), '')), 'C')
  WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to convert JSONB to text
CREATE OR REPLACE FUNCTION jsonb_to_text(data JSONB)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
BEGIN
  -- Simple flattening of JSON structure to text
  -- In a real implementation, you'd want a more sophisticated conversion
  IF data IS NULL THEN
    RETURN '';
  END IF;
  
  -- Try to extract array values for entities
  IF jsonb_typeof(data) = 'object' THEN
    FOR key IN SELECT * FROM jsonb_object_keys(data)
    LOOP
      IF jsonb_typeof(data->key) = 'array' THEN
        result := result || ' ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(data->key)), ' ');
      ELSE
        result := result || ' ' || key || ' ' || data->>key;
      END IF;
    END LOOP;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

With these updates, the `search_vector` columns will include:

1. **For posts**:
   - Title (weight A - highest priority)
   - Content (weight B)
   - AI-extracted topics (weight A)
   - Semantic tags (weight A)
   - Locations (weight B)
   - Entities (weight C)

2. **For comments**:
   - Comment content (weight A)
   - AI-extracted topics (weight A)
   - Thread context (weight B)
   - Entities (weight C)

This ensures that all AI-extracted metadata enhances the BM25 keyword search capability, making both search systems (keyword and vector) benefit from our enrichment process.
