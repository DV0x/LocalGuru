
# LocalGuru Ingestion System: Technical Overview

## 1. System Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│  Reddit API         │────▶│  Ingestion Service  │────▶│  Supabase Database  │
│  (Data Source)      │     │  (Processing)       │     │  (Storage)          │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                      │                           │
                                      │                           │
                                      ▼                           ▼
                            ┌─────────────────────┐     ┌─────────────────────┐
                            │                     │     │                     │
                            │  Embedding Service  │◀───▶│  Embedding Queue    │
                            │  (ML Processing)    │     │  (Async Processing) │
                            │                     │     │                     │
                            └─────────────────────┘     └─────────────────────┘
```

## 2. Core Components

### 2.1 Data Flow and Processing

The LocalGuru ingestion system follows this workflow:

1. **Data Acquisition**: Content is fetched from Reddit using their API
2. **Content Processing**: Text is normalized, cleaned, and prepared for storage
3. **Database Storage**: Content is stored in Supabase (PostgreSQL)
4. **Embedding Queue**: Modified content is added to an embedding queue
5. **Vector Embedding**: Text is converted to vector embeddings for semantic search
6. **Metadata Extraction**: Additional processing extracts entities, locations, topics

```
┌─────────┐     ┌──────────┐     ┌────────────┐     ┌────────────┐     ┌─────────────┐
│         │     │          │     │            │     │            │     │             │
│ Fetch   │────▶│ Process  │────▶│ Store in   │────▶│ Queue for  │────▶│ Generate    │
│ Content │     │ Content  │     │ Database   │     │ Embedding  │     │ Embeddings  │
│         │     │          │     │            │     │            │     │             │
└─────────┘     └──────────┘     └────────────┘     └────────────┘     └─────────────┘
```

### 2.2 Database Schema

```
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│ reddit_posts         │       │ reddit_comments     │       │ embedding_queue     │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │       │ id (PK)             │
│ subreddit           │       │ post_id (FK)        │       │ record_id           │
│ title               │───┐   │ content             │───┐   │ schema_name         │
│ content             │   │   │ author_id           │   │   │ table_name          │
│ url                 │   │   │ created_at          │   │   │ content_function    │
│ permalink           │   │   │ score               │   │   │ embedding_column    │
│ author_id           │   │   │ is_removed          │   │   │ created_at          │
│ created_at          │   │   │ embedding           │   └──▶│ status              │
│ score               │   │   │ parent_id           │       │ attempts            │
│ upvote_ratio        │   │   │ last_updated        │       │ last_error          │
│ is_nsfw             │   │   │ original_json       │       │ processed_at        │
│ is_spoiler          │   │   │ last_checked        │       │ priority            │
│ flair               │   │   │ update_count        │       │ subreddit           │
│ is_self_post        │   │   └─────────────────────┘       │ estimated_tokens    │
│ embedding           │   │                                 │ is_update           │
│ search_vector       │   │                                 │ reason              │
│ last_updated        │   │                                 │ cooldown_until      │
│ original_json       │   │                                 └─────────────────────┘
│ extracted_entities  │   │   
│ extracted_topics    │   │   
│ extracted_locations │   │   
│ semantic_tags       │   │   
│ content_checksum    │   │   
│ last_checked        │   │   
│ update_count        │   │   
│ is_removed          │   │   
└─────────────────────┘   │   
                          │   
                          └──▶
```

## 3. Key Components Deep Dive

### 3.1 DBHandler

The `DBHandler` class is the primary interface for database operations. It handles:

- Batch insertion of posts and comments
- Content updates
- Database queries
- Error handling and logging

```typescript
// Simplified DBHandler class structure
class DBHandler {
  private supabase: SupabaseClient;
  
  constructor(params: IDBHandlerParams) {
    // Initialize Supabase client
  }
  
  // Inserts new posts into the database in batches
  async insertPosts(posts: RedditPost[]): Promise<string[]> {
    // Process posts in batches
    // Return successful post IDs
  }
  
  // Updates existing posts, typically setting last_checked
  async updatePosts(posts: RedditPost[]): Promise<string[]> {
    // Update posts in batches
    // Return successful post IDs
  }
  
  // Similar methods for comments
  async insertComments(comments: RedditComment[]): Promise<string[]> { /*...*/ }
  async updateComments(comments: RedditComment[]): Promise<string[]> { /*...*/ }
}
```

### 3.2 Embedding Queue System

The embedding queue manages asynchronous processing of text-to-vector conversions:

```
┌───────────────┐     ┌─────────────────┐     ┌────────────────┐
│               │     │                 │     │                │
│ Database      │     │ Embedding Queue │     │ Embedding      │
│ Triggers      │────▶│ (util schema)   │────▶│ Processor      │
│               │     │                 │     │                │
└───────────────┘     └─────────────────┘     └────────────────┘
        │                                             │
        │                                             │
        │                                             ▼
┌───────────────┐                           ┌────────────────┐
│               │                           │                │
│ Content       │                           │ Vector         │
│ Updates       │                           │ Embeddings     │
│               │                           │                │
└───────────────┘                           └────────────────┘
```

#### Triggers

Database triggers automatically add records to the embedding queue when content is created or updated:

```sql
-- Sample trigger for posts (simplified)
CREATE TRIGGER embed_posts_on_update
AFTER UPDATE ON public.reddit_posts
FOR EACH ROW
WHEN (
  -- Only trigger when title or content changes
  old.title IS DISTINCT FROM new.title OR
  old.content IS DISTINCT FROM new.content
)
EXECUTE FUNCTION util.queue_for_embedding('reddit_posts', 'post_embedding_input', 'embedding');
```

### 3.3 Change Detection System

The `ChangeDetector` ensures that updates only occur when actual content changes:

```typescript
// Simplified ChangeDetector class
class ChangeDetector {
  // Determines if a post has been updated based on content comparison
  static hasPostBeenUpdated(oldPost: RedditPost, newPost: RedditPost): boolean {
    // Compare relevant fields
    // Return true if content has changed
  }
  
  // Similar method for comments
  static hasCommentBeenUpdated(oldComment: RedditComment, newComment: RedditComment): boolean {
    // Compare relevant fields
    // Return true if content has changed
  }
}
```

## 4. Key Processes

### 4.1 Content Ingestion Flow

```
┌──────────────┐     ┌───────────────┐     ┌─────────────────────┐
│              │     │               │     │                     │
│ Fetch from   │────▶│ Process and   │────▶│ Check for Existing  │
│ Reddit API   │     │ Clean Content │     │ Content             │
│              │     │               │     │                     │
└──────────────┘     └───────────────┘     └─────────────────────┘
                                                     │
                                                     │
                    ┌───────────────┐                │
                    │               │      No        │
                    │ Insert as     │◀───────────────┘
                    │ New Content   │                │
                    │               │                │
                    └───────────────┘                │
                           │                         │
                           │                         │
                           ▼                         ▼
                    ┌───────────────┐     ┌─────────────────────┐
                    │               │     │                     │
                    │ Added to      │     │ Update              │
                    │ Embed Queue   │     │ last_checked        │
                    │               │     │                     │
                    └───────────────┘     └─────────────────────┘
                                                     │
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │                     │ Yes
                                          │ Content Changed?    │────┐
                                          │                     │    │
                                          └─────────────────────┘    │
                                                                     │
                                                                     ▼
                                                          ┌─────────────────────┐
                                                          │                     │
                                                          │ Added to            │
                                                          │ Embed Queue         │
                                                          │                     │
                                                          └─────────────────────┘
```

### 4.2 Embedding Process

```
┌───────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│               │     │                   │     │                     │
│ Pull from     │────▶│ Extract Content   │────▶│ Generate Vector     │
│ Embed Queue   │     │ Using Function    │     │ Embedding           │
│               │     │                   │     │                     │
└───────────────┘     └───────────────────┘     └─────────────────────┘
                                                          │
                                                          │
                    ┌───────────────────┐                 │
                    │                   │                 │
                    │ Update Queue      │◀────────────────┘
                    │ Status            │
                    │                   │
                    └───────────────────┘
                              │
                              │
                              ▼
                    ┌───────────────────┐
                    │                   │
                    │ Update Content    │
                    │ with Embedding    │
                    │                   │
                    └───────────────────┘
```

## 5. Critical System Functions

### 5.1 Trigger Management

The system includes a function to enable/disable triggers for maintenance:

```sql
CREATE OR REPLACE FUNCTION util.alter_triggers(
  p_table_name text,
  p_enable boolean
) RETURNS void AS $$
DECLARE
  trigger_name text;
BEGIN
  FOR trigger_name IN
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = p_table_name
  LOOP
    IF p_enable THEN
      EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', p_table_name, trigger_name);
    ELSE
      EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', p_table_name, trigger_name);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 5.2 Embedding Queue Functions

The system uses database functions to manage the embedding queue:

```sql
-- Add item to embedding queue
CREATE OR REPLACE FUNCTION util.queue_for_embedding(
  _table_name text,
  _content_function text,
  _embedding_column text,
  _is_update boolean DEFAULT false
) RETURNS void AS $$
BEGIN
  INSERT INTO util.embedding_queue (
    record_id, schema_name, table_name, content_function, 
    embedding_column, is_update
  )
  VALUES (
    NEW.id, TG_TABLE_SCHEMA, _table_name, _content_function, 
    _embedding_column, _is_update
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 6. Database Extensions

The system relies on several PostgreSQL extensions:

### 6.1 Vector Extension (pgvector)

Used for storing and querying vector embeddings, enabling semantic search:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6.2 HStore Extension

Used for managing key-value pairs within database functions:

```sql
CREATE EXTENSION IF NOT EXISTS hstore;
```

### 6.3 Full-Text Search

Used for text search capabilities alongside vector search:

```sql
-- Example of search vector index
CREATE INDEX idx_reddit_posts_search ON public.reddit_posts USING gin(search_vector);
```

## 7. Maintenance Procedures

### 7.1 Trigger Management

To temporarily disable triggers during bulk operations:

```sql
-- Disable triggers
SELECT util.alter_triggers('reddit_posts', false);

-- Perform operations

-- Re-enable triggers
SELECT util.alter_triggers('reddit_posts', true);
```

### 7.2 Embedding Queue Monitoring

Regular monitoring of the embedding queue status:

```sql
-- Check pending items
SELECT COUNT(*) FROM util.embedding_queue WHERE status = 'pending';

-- Check failed items
SELECT * FROM util.embedding_queue WHERE status = 'error' ORDER BY created_at DESC LIMIT 10;
```

### 7.3 Testing Embedding Triggers

Test if content updates are properly triggering the embedding queue:

```sql
-- Update a post title
UPDATE public.reddit_posts 
SET title = 'Updated title ' || now() 
WHERE id = 'example_id';

-- Check if record was added to queue
SELECT * FROM util.embedding_queue 
WHERE record_id = 'example_id' 
ORDER BY created_at DESC;
```

## 8. Troubleshooting Guide

### 8.1 Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Content not being embedded | Triggers disabled | Check and enable triggers using `util.alter_triggers` |
| `hstore` related errors | Extension not installed | Run `CREATE EXTENSION hstore;` |
| Updates not triggering queue | Content hasn't changed | Verify field changes match trigger conditions |
| Queue processing stuck | Failed embedding attempts | Check queue status and reset failed items |

### 8.2 Diagnostic Queries

```sql
-- Check trigger status
SELECT trigger_name, trigger_enabled 
FROM information_schema.triggers 
WHERE event_object_table = 'reddit_posts';

-- Check embedding queue health
SELECT status, COUNT(*) 
FROM util.embedding_queue 
GROUP BY status;
```

## 9. Performance Considerations

- Batch processing is used throughout the system to minimize database connections
- The embedding queue uses a priority system for processing important content first
- Triggers only fire when critical content (title, content) changes, not on metadata updates
- Database indices are strategically placed on frequently queried columns

This comprehensive documentation should provide your backend engineer with the information needed to maintain and troubleshoot the LocalGuru ingestion system effectively.
