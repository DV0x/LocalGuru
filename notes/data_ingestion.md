
Let me look for these Supabase Edge Functions to understand their implementation:

Ran tool
Great! I found both functions. Let's first look at the process-queue function:

Ran tool

Read file: supabase/functions/process-queue/index.ts
Now let's look at the enhanced-embeddings function:

Ran tool

Read file: supabase/functions/enhanced-embeddings/index.ts
Let's look at more of the enhanced-embeddings function to understand the main implementation:

Read file: supabase/functions/enhanced-embeddings/index.ts
Let's see the rest of the enhanced-embeddings function:

Read file: supabase/functions/enhanced-embeddings/index.ts
Based on examining these two functions, I can now provide a thorough explanation of the data ingestion and embedding generation process in Localguru:

### 1. Process Queue Function

The `process-queue` Edge Function serves as the orchestrator for processing items in the embedding queue:

**Key Features:**
- Fetches pending jobs from the queue with a batch size of 10
- Prioritizes jobs based on importance (higher priority value = more important)
- Implements rate limiting through a token budget system (100,000 tokens)
- Processes jobs concurrently with a maximum concurrency of 5
- Tracks performance metrics for all operations

**Processing Flow:**
1. Fetches pending jobs from the embedding queue
2. Sorts jobs by priority
3. For each job:
   - Marks the job as "processing" 
   - Retrieves content using the job's specified content function
   - Estimates token usage to prevent exceeding the budget
   - Calls the enhanced-embeddings function with parameters:
     - contentId: The record ID
     - contentType: post or comment
     - includeContext: true (always include thread context)
     - refreshRepresentations: true (to store representations)
   - Updates the original table with metadata
   - Records metrics and marks job as completed

### 2. Enhanced Embeddings Function

The `enhanced-embeddings` Edge Function handles the actual generation of embeddings and enriched metadata:

**Key Features:**
- Creates multiple representation types for each piece of content
- Extracts entities, topics, locations, and semantic tags
- Builds thread context for comments
- Stores embeddings in the `content_representations` table
- Chunks long content for more effective retrieval

**Processing Flow:**
1. Retrieves the content (post or comment) from the database
2. For comments, builds thread context with parent comments
3. Extracts entities using a shared utility (`entity-extraction.ts`)
4. Generates multiple embedding representations:
   - **Basic**: Simple content embedding 
   - **Title**: For posts, a title-specific embedding
   - **Context-enhanced**: Enriched with metadata and thread context
5. Stores each representation in the `content_representations` table
6. For long content, chunks the text and creates embeddings for each chunk
7. Updates the original tables (`reddit_posts` or `reddit_comments`) with extracted metadata
8. Returns success status with details of the created embeddings

### Implementation Details:

1. **Vector Embeddings:**
   - Uses OpenAI's `text-embedding-3-small` model
   - Enables multiple representation types for better search precision
   - Stores embeddings as vectors in the database

2. **Entity Extraction:**
   - Analyzes content to identify entities, topics, locations
   - Enhances search with semantic tags
   - Stores extracted data as metadata

3. **Thread Context:**
   - For comments, builds a hierarchical context of the conversation
   - Includes parent comments, post title, and subreddit information
   - Creates a thread summary for enhanced search

4. **Content Chunking:**
   - Splits long content at sentence boundaries
   - Preserves semantic meaning in chunks
   - Each chunk gets its own embedding

5. **Metadata Enrichment:**
   - All embeddings include metadata for better search filtering
   - Topics and locations are highlighted for geographic and topical search
   - Thread context provides conversational understanding

This advanced implementation allows Localguru to perform sophisticated semantic searches across Reddit content, understanding not just keywords but the intent, context, and relationships between content items.
