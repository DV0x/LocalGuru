# Database Schema

## Overview

The LocalGuru application uses a PostgreSQL database hosted on Supabase with vector search capabilities enabled through the pgvector extension. The database schema is designed to store Reddit content (posts and comments), vector embeddings for semantic search, and metrics for monitoring system performance.

## Tables

### Content Storage

#### `reddit_posts`
Stores Reddit posts with metadata and vector embeddings for search.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key, Reddit post ID |
| subreddit | text | Subreddit name |
| title | text | Post title |
| content | text | Post content/body |
| url | text | URL if post links externally |
| permalink | text | Reddit permalink |
| author_id | text | Author identifier |
| created_at | timestamptz | Post creation timestamp |
| score | integer | Reddit score/upvotes |
| upvote_ratio | numeric | Ratio of upvotes to total votes |
| is_nsfw | boolean | Flag for NSFW content |
| is_spoiler | boolean | Flag for spoiler content |
| flair | text | Post flair |
| is_self_post | boolean | Whether post is text-only |
| embedding | vector | Vector embedding for semantic search |
| search_vector | tsvector | Text search index |
| extracted_entities | jsonb | Named entities extracted from content |
| extracted_topics | text[] | Topics extracted from content |
| extracted_locations | text[] | Locations mentioned in content |
| semantic_tags | text[] | AI-generated semantic tags |
| is_removed | boolean | Whether post has been removed |

#### `reddit_comments`
Stores Reddit comments with vector embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key, Reddit comment ID |
| post_id | text | Parent post ID |
| parent_id | text | Parent comment ID (if reply) |
| author_id | text | Author identifier |
| content | text | Comment text |
| created_at | timestamptz | Comment creation timestamp |
| score | integer | Comment score/upvotes |
| depth | integer | Nesting level in comment thread |
| path | text[] | Path in comment tree |
| is_stickied | boolean | Whether comment is pinned |
| embedding | vector | Vector embedding for semantic search |
| search_vector | tsvector | Text search index |
| extracted_entities | jsonb | Named entities extracted from content |
| extracted_topics | text[] | Topics extracted from content |
| thread_context | text | Context from the thread |
| is_removed | boolean | Whether comment has been removed |

#### `reddit_users`
Stores information about Reddit users who authored posts or comments.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key, Reddit user ID |
| username | text | Reddit username |
| created_at | timestamptz | Record creation timestamp |
| is_bot | boolean | Flag for bot accounts |
| data | jsonb | Additional user data |

### Vector Representations

#### `content_representations`
Stores different types of vector embeddings for the same content.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| parent_id | text | ID of parent content |
| content_type | text | Type of content (post, comment) |
| representation_type | text | Type of embedding representation |
| embedding | vector | Vector embedding |
| created_at | timestamptz | Creation timestamp |
| metadata | jsonb | Additional metadata |

#### `content_chunks`
Stores smaller chunks of content with their embeddings for more granular search.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| parent_id | text | ID of parent content |
| content_type | text | Type of content |
| chunk_index | integer | Index of the chunk |
| chunk_text | text | Chunk content |
| embedding | vector | Vector embedding of chunk |
| created_at | timestamptz | Creation timestamp |

#### `embedding_cache`
Caches embeddings for query strings to improve performance.

| Column | Type | Description |
|--------|------|-------------|
| query_hash | text | Hash of the query text |
| query_text | text | Original query text |
| created_at | timestamptz | Creation timestamp |
| dimensions | integer | Vector dimensions |
| source_model | text | Model used for embedding |
| embedding | vector | Vector embedding |

### Monitoring and Feedback

#### `search_performance_logs`
Logs search performance metrics for monitoring and optimization.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| query | text | Search query |
| intent | text | Detected query intent |
| vector_weight | double precision | Vector search weight |
| text_weight | double precision | Text search weight |
| ef_search | integer | HNSW ef_search parameter |
| duration_ms | double precision | Search duration in ms |
| result_count | integer | Number of results returned |
| timed_out | boolean | Whether search timed out |
| created_at | timestamptz | Creation timestamp |

#### `search_feedback`
Stores user feedback on search results for quality improvement.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| content_id | text | ID of rated content |
| query | text | Search query |
| is_helpful | boolean | Whether result was helpful |
| feedback_source | text | Source of feedback |
| feedback_details | text | Additional feedback |
| created_at | timestamptz | Creation timestamp |
| user_id | uuid | User ID if authenticated |

#### `embedding_metrics`
Records processing metrics for embedding generation.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| timestamp | timestamptz | Record timestamp |
| job_type | text | Type of embedding job |
| content_length | integer | Length of processed content |
| chunk_count | integer | Number of chunks created |
| processing_time_ms | integer | Processing time in ms |
| subreddit | text | Source subreddit |
| is_successful | boolean | Job success status |
| error_message | text | Error details if failed |

## Vector Indexes

The database uses HNSW (Hierarchical Navigable Small World) indexes for efficient vector search:

```sql
CREATE INDEX ON content_representations USING hnsw (embedding vector_l2_ops)
  WITH (ef_construction = 128, m = 16);

CREATE INDEX ON reddit_comments USING hnsw (embedding vector_l2_ops) 
  WITH (ef_construction = 128, m = 16);

CREATE INDEX ON reddit_posts USING hnsw (embedding vector_l2_ops)
  WITH (ef_construction = 128, m = 16);
```

## Full-Text Search Indexes

Text search is enabled through GIN indexes on tsvector columns:

```sql
CREATE INDEX idx_reddit_comments_search_vector ON reddit_comments USING GIN (search_vector);
CREATE INDEX idx_reddit_posts_search_vector ON reddit_posts USING GIN (search_vector);
```

## Database Functions

The database includes several functions for search operations, most notably:

1. `comment_only_search_with_timeout` - The main search function that implements two-phase retrieval
2. `hybrid_search` - A generalized hybrid search function for various content types 
3. `content_tree` - Retrieves threaded comments in a hierarchical structure

## Schema Management

Database schema migrations are managed through Supabase migrations in the `supabase/migrations/` directory. The migrations handle:

1. Table creation
2. Index creation
3. Function definitions
4. Permission grants
5. Vector extension setup

## Performance Considerations

1. **HNSW Parameters**: The vector indexes use parameters optimized for search quality vs. speed tradeoff
2. **Timeout Handling**: Search functions include timeout handling with fallback to text search
3. **Caching**: Query embeddings are cached to reduce computation load
4. **Two-Phase Retrieval**: The search implementation uses a two-phase approach to optimize performance 