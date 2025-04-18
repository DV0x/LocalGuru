2. Embedding Generation Process

**Queue Processing:**
- The `process-queue` Edge Function continuously monitors the queue
- Items are processed in priority order with rate limiting
- Each item is marked as "processing" while being handled
- **Important:** The process-queue function tries use `enhanced-embeddings` 

**Comprehensive Processing (via enhanced-embeddings):**
- The `enhanced-embeddings` Edge Function performs all of these tasks in a single operation:
  - **Content Extraction:** Prepares content from posts or comments
  - **Entity Extraction:** Uses AI to identify entities, topics, locations, and semantic tags
  - **Thread Context Building:** For comments, builds a hierarchical representation of the conversation
  - **Multi-Representation Generation:** Creates different embedding types (basic, title, context_enhanced)
  - **Content Chunking:** Splits long content into semantically meaningful chunks

## 3. Storage Architecture

**Multi-Representation Storage:**
- Primary storage for embeddings is the `content_representations` table:
  - Contains different representation types per content item
  - Stores embeddings with metadata about type, context, etc.
  - Links to original content via parent_id
  
**Metadata Storage in Original Tables:**
- Extracted information is stored back in the original tables:
  - **For posts (`reddit_posts`):** Entities, topics, locations, semantic tags
  - **For comments (`reddit_comments`):** Entities, topics, and thread context JSON
- The original embedding columns may remain empty as embeddings are now primarily stored in `content_representations`

**Content Chunking:**
- For content exceeding certain length thresholds:
  - Content is split into manageable chunks
  - Each chunk gets its own embedding
  - Chunks are stored in the `content_chunks` table with links to original content
