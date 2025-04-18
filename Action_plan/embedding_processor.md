
# Detailed Implementation Plan: Migration to 512-Dimension HNSW Embeddings

## Overview
This plan details how to implement the migration from the current embedding system to the new 512-dimension HNSW vector indexing system, focusing on optimizing search performance while maintaining semantic quality.

## Phase 1: Database Updates
The HNSW migration SQL has already been implemented. Verify these changes:

1. Vector dimensions are set to 512
2. IVFFlat indexes were replaced with HNSW indexes 
3. Store function was updated to only accept 'title' and 'context_enhanced' types
4. Verify the function `get_queue_statistics()` exists; if not, create it:

```sql
CREATE OR REPLACE FUNCTION get_queue_statistics()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'completion_percentage', 
      CASE WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*)), 2) 
        ELSE 0 
      END
  ) INTO result
  FROM embedding_queue;
  
  RETURN result;
END;
$$;
```

## Phase 2: Backend Service Implementation

### Step 1: Project Setup
1. Create a new Node.js project:
```bash
mkdir -p embedding-processor/src
cd embedding-processor
npm init -y
npm install @supabase/supabase-js openai dotenv typescript ts-node
npm install --save-dev @types/node
```

2. Create tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

3. Create .env file:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
BATCH_SIZE=10
LOG_LEVEL=info
```

### Step 2: Create Shared Services

1. Create `src/services/types.ts`:
```typescript
// src/services/types.ts
export interface QueueItem {
  id: string;
  content_id: string;
  content_type: 'post' | 'comment';
  status: string;
  priority: number;
  created_at: string;
  updated_at?: string;
  processed_at?: string;
  error_message?: string;
}

export interface Post {
  id: string;
  title: string;
  content?: string;
  subreddit: string;
}

export interface Comment {
  id: string;
  content?: string;
  post_id: string;
  parent_id?: string;
  path?: string[];
  post?: {
    title: string;
    subreddit: string;
  };
}

export interface ThreadContext {
  postId: string;
  postTitle: string;
  subreddit: string;
  parentId?: string;
  path?: string[];
  depth?: number;
  summary?: string;
  parent_comments?: ParentComment[];
}

export interface ParentComment {
  id: string;
  content: string;
}

export interface EntityExtractionResult {
  entities: Record<string, string[] | undefined>;
  topics: string[];
  locations: string[];
  semanticTags: string[];
}

export interface EntityTags {
  topics: string[];
  locations?: string[];
  semanticTags?: string[];
}
```

2. Create `src/services/supabase.ts`:
```typescript
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
```

3. Create `src/services/embedding-service.ts`:
```typescript
// src/services/embedding-service.ts
import { OpenAI } from 'openai';
import { supabase } from './supabase';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Create a 512-dimension embedding using text-embedding-3-large
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
      encoding_format: 'float',
      dimensions: 512  // Specific 512 dimensions for HNSW
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Store a content representation in the database
 */
export async function storeContentRepresentation(
  contentId: string,
  contentType: 'post' | 'comment',
  representationType: string,
  embedding: number[],
  metadata: Record<string, any> = {}
): Promise<string | null> {
  try {
    console.log(`Storing ${representationType} representation for ${contentType} ${contentId}...`);
    
    const { data, error } = await supabase.rpc(
      'store_content_representation',
      {
        p_content_id: contentId,
        p_content_type: contentType,
        p_representation_type: representationType,
        p_embedding_vector: embedding,
        p_metadata: metadata
      }
    );
    
    if (error) {
      console.error(`Error storing ${representationType} representation:`, error);
      return null;
    }
    
    return data as string;
  } catch (error) {
    console.error(`Error in storeContentRepresentation for ${representationType}:`, error);
    return null;
  }
}
```

4. Create `src/services/entity-extraction.ts`:
```typescript
// src/services/entity-extraction.ts
import { OpenAI } from 'openai';
import { EntityExtractionResult } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract entities using GPT-4 Turbo
 */
export async function extractEntities(
  content: string,
  contentType: 'post' | 'comment',
  context: {
    subreddit?: string;
    title?: string;
    postTitle?: string;
  }
): Promise<EntityExtractionResult> {
  try {
    console.log(`Extracting entities for ${contentType} with GPT-4 Turbo...`);
    
    // Create a prompt with context for better extraction
    const contextString = [
      context.subreddit ? `Subreddit: r/${context.subreddit}` : '',
      context.title ? `Title: ${context.title}` : '',
      context.postTitle ? `Post Title: ${context.postTitle}` : '',
    ].filter(Boolean).join('\n');
    
    // Use GPT-4 Turbo for high-quality entity extraction
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured information from text.
          Extract entities, topics, locations, and semantic tags from the provided content.
          Be specific and concise. Return only a valid JSON object with no additional text.`
        },
        {
          role: 'user',
          content: `Extract structured information from this ${contentType}:
          
${contextString}

Content: ${content}

Return a JSON object with this structure:
{
  "entities": {
    "people": [],
    "organizations": [],
    "products": [],
    "technologies": [],
    "events": [],
    "other": []
  },
  "topics": [],
  "locations": [],
  "semanticTags": []
}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    // Parse the JSON response
    const resultContent = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(resultContent) as EntityExtractionResult;
    
    return {
      entities: result.entities || {},
      topics: result.topics || [],
      locations: result.locations || [],
      semanticTags: result.semanticTags || []
    };
  } catch (error) {
    console.error('Error extracting entities:', error);
    // Return empty result on error
    return {
      entities: {},
      topics: [],
      locations: [],
      semanticTags: []
    };
  }
}
```

5. Create `src/services/thread-context.ts`:
```typescript
// src/services/thread-context.ts
import { OpenAI } from 'openai';
import { ThreadContext, Post, ParentComment, EntityTags } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Build thread context for a comment
 */
export function buildThreadContext(
  commentId: string,
  post: Post,
  parentComments: ParentComment[]
): ThreadContext {
  // Sort parent comments by ID to ensure correct order
  const sortedParents = [...parentComments].sort((a, b) => a.id.localeCompare(b.id));
  
  return {
    postId: post.id,
    postTitle: post.title,
    subreddit: post.subreddit,
    path: sortedParents.map(p => p.id),
    depth: sortedParents.length,
    parent_comments: sortedParents,
    summary: '' // Will be populated later
  };
}

/**
 * Generate a thread summary using GPT-4 Turbo
 */
export async function generateThreadSummary(
  context: ThreadContext
): Promise<string> {
  try {
    if (!context.parent_comments || context.parent_comments.length === 0) {
      return '';
    }
    
    const commentTexts = context.parent_comments.map(c => c.content).join('\n\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'Provide a brief summary of this Reddit conversation thread in 1-2 sentences.'
        },
        {
          role: 'user',
          content: `Subreddit: r/${context.subreddit}
Post Title: ${context.postTitle}

Thread Comments:
${commentTexts}

Summarize this thread concisely.`
        }
      ],
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating thread summary:', error);
    return '';
  }
}

/**
 * Get thread summary - returns existing or generates new
 */
export async function getThreadSummary(context: ThreadContext): Promise<string> {
  if (context.summary) {
    return context.summary;
  }
  
  if (context.parent_comments && context.parent_comments.length > 0) {
    return await generateThreadSummary(context);
  }
  
  return '';
}

/**
 * Create enhanced input for thread context
 */
export function createThreadEnhancedInput(
  commentContent: string,
  threadContext: ThreadContext,
  entityTags: EntityTags
): string {
  // Create an enhanced representation that includes thread context
  let enhancedContent = `Subreddit: r/${threadContext.subreddit || 'unknown'}
Post Title: ${threadContext.postTitle || ''}
`;

  // Add topics if available
  if (entityTags.topics && entityTags.topics.length > 0) {
    enhancedContent += `Topics: ${entityTags.topics.join(', ')}\n`;
  }
  
  // Add locations if available
  if (entityTags.locations && entityTags.locations.length > 0) {
    enhancedContent += `Locations: ${entityTags.locations.join(', ')}\n`;
  }
  
  // Add semantic tags if available
  if (entityTags.semanticTags && entityTags.semanticTags.length > 0) {
    enhancedContent += `Tags: ${entityTags.semanticTags.join(', ')}\n`;
  }
  
  // Add thread depth
  enhancedContent += `Thread Depth: ${threadContext.depth || 0}\n`;
  
  // Add thread summary if available
  if (threadContext.summary) {
    enhancedContent += `Thread Summary: ${threadContext.summary}\n`;
  }
  
  // Add parent comments summaries if available
  if (threadContext.parent_comments && threadContext.parent_comments.length > 0) {
    enhancedContent += `\nParent Comments Summary:\n`;
    threadContext.parent_comments.forEach((comment, index) => {
      // Truncate long comments
      const truncatedContent = comment.content.length > 100 
        ? comment.content.substring(0, 100) + '...' 
        : comment.content;
      enhancedContent += `${index + 1}. ${truncatedContent}\n`;
    });
  }
  
  // Add the actual comment content
  enhancedContent += `\nComment Content: ${commentContent}`;
  
  return enhancedContent;
}
```

### Step 3: Create Processing Logic

1. Create `src/processors/content-processor.ts`:
```typescript
// src/processors/content-processor.ts
import { supabase } from '../services/supabase';
import { createEmbedding, storeContentRepresentation } from '../services/embedding-service';
import { extractEntities } from '../services/entity-extraction';
import { buildThreadContext, getThreadSummary, createThreadEnhancedInput } from '../services/thread-context';
import { ThreadContext, ParentComment } from '../services/types';

/**
 * Process a single content item (post or comment)
 */
export async function processContentItem(
  contentId: string,
  contentType: 'post' | 'comment'
): Promise<void> {
  console.log(`Processing ${contentType} ${contentId}...`);
  
  let content: any;
  let threadContext: ThreadContext = {
    postId: '',
    postTitle: '',
    subreddit: ''
  };
  let contentText = '';
  
  // Get content data
  if (contentType === 'post') {
    // Fetch post data
    const { data: post, error } = await supabase
      .from('reddit_posts')
      .select('id, title, content, subreddit')
      .eq('id', contentId)
      .single();
    
    if (error || !post) {
      throw new Error(`Post not found: ${error?.message}`);
    }
    
    content = post;
    contentText = `${post.title}\n\n${post.content || ''}`;
    
    // For posts, build a simpler context
    threadContext = {
      postId: post.id,
      postTitle: post.title,
      subreddit: post.subreddit
    };
    
  } else if (contentType === 'comment') {
    // Fetch comment with post data
    const { data: comment, error } = await supabase
      .from('reddit_comments')
      .select(`id, content, post_id, parent_id, path, 
              post:post_id (title, subreddit)`)
      .eq('id', contentId)
      .single();
    
    if (error || !comment) {
      throw new Error(`Comment not found: ${error?.message}`);
    }
    
    content = comment;
    contentText = comment.content || '';
    
    // Get parent comments if available
    if (comment.path && comment.path.length > 0) {
      const { data: parents } = await supabase
        .from('reddit_comments')
        .select('id, content')
        .in('id', comment.path)
        .order('id');
      
      if (parents) {
        // Build thread context
        threadContext = buildThreadContext(
          comment.id,
          {
            id: comment.post_id,
            title: comment.post?.title || '',
            subreddit: comment.post?.subreddit || ''
          },
          parents as ParentComment[]
        );
        
        // Generate thread summary
        threadContext.summary = await getThreadSummary(threadContext);
      } else {
        threadContext = {
          postId: comment.post_id,
          postTitle: comment.post?.title || '',
          subreddit: comment.post?.subreddit || '',
          path: comment.path
        };
      }
    } else {
      threadContext = {
        postId: comment.post_id,
        postTitle: comment.post?.title || '',
        subreddit: comment.post?.subreddit || ''
      };
    }
  } else {
    throw new Error(`Invalid content type: ${contentType}`);
  }
  
  // Extract entities with GPT-4 Turbo
  console.log(`Extracting entities for ${contentType} ${contentId}...`);
  const extractedEntities = await extractEntities(
    contentText, 
    contentType, 
    contentType === 'post' 
      ? { subreddit: threadContext.subreddit, title: threadContext.postTitle } 
      : { subreddit: threadContext.subreddit, postTitle: threadContext.postTitle }
  );
  
  // Common metadata for all embeddings
  const entityMetadata = {
    topics: extractedEntities.topics,
    entities: extractedEntities.entities,
    locations: extractedEntities.locations,
    semanticTags: extractedEntities.semanticTags
  };
  
  // Generate and store embeddings
  console.log(`Generating embeddings for ${contentType} ${contentId}...`);
  
  // 1. For posts, create title embedding
  if (contentType === 'post' && content.title) {
    console.log(`Generating title embedding for post ${contentId}...`);
    const titleEmbedding = await createEmbedding(content.title);
    await storeContentRepresentation(
      contentId,
      contentType,
      'title',
      titleEmbedding,
      {
        type: 'title',
        length: content.title.length,
        tokenEstimate: Math.ceil(content.title.length / 4),
        ...entityMetadata
      }
    );
  }
  
  // 2. Create context-enhanced embedding
  console.log(`Generating context-enhanced embedding for ${contentType} ${contentId}...`);
  let enhancedContent = '';
  
  if (contentType === 'post') {
    enhancedContent = `Subreddit: r/${threadContext.subreddit || 'unknown'}
Title: ${content.title || ''}
Topics: ${extractedEntities.topics.join(', ')}
${extractedEntities.locations.length > 0 ? `Locations: ${extractedEntities.locations.join(', ')}` : ''}
${extractedEntities.semanticTags.length > 0 ? `Tags: ${extractedEntities.semanticTags.join(', ')}` : ''}
Content: ${content.content || ''}`;
  } else {
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
  
  const contextEmbedding = await createEmbedding(enhancedContent);
  await storeContentRepresentation(
    contentId,
    contentType,
    'context_enhanced',
    contextEmbedding,
    {
      type: 'context_enhanced',
      length: enhancedContent.length,
      tokenEstimate: Math.ceil(enhancedContent.length / 4),
      thread_context: threadContext,
      ...entityMetadata
    }
  );
  
  // 3. Update original content table with metadata
  console.log(`Updating metadata for ${contentType} ${contentId}...`);
  
  if (contentType === 'post') {
    await supabase
      .from('reddit_posts')
      .update({
        extracted_entities: extractedEntities.entities,
        extracted_topics: extractedEntities.topics,
        extracted_locations: extractedEntities.locations,
        semantic_tags: extractedEntities.semanticTags
      })
      .eq('id', contentId);
  } else {
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
  }
  
  console.log(`Successfully processed ${contentType} ${contentId}`);
}
```

2. Create `src/processors/queue-processor.ts`:
```typescript
// src/processors/queue-processor.ts
import { supabase } from '../services/supabase';
import { processContentItem } from './content-processor';
import dotenv from 'dotenv';

dotenv.config();

// Default batch size
const DEFAULT_BATCH_SIZE = 10;

/**
 * Process a batch of items from the queue
 */
export async function processQueue(
  batchSize = Number(process.env.BATCH_SIZE || DEFAULT_BATCH_SIZE)
) {
  try {
    console.log(`Starting to process queue with batch size ${batchSize}`);
    
    // Get pending queue items
    const { data: queueItems, error } = await supabase
      .from('embedding_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(batchSize);
      
    if (error) {
      throw new Error(`Failed to fetch queue items: ${error.message}`);
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return { processed: 0, queueItems: [] };
    }
    
    console.log(`Found ${queueItems.length} pending items to process`);
    let processed = 0;
    const results = [];
    
    // Process each item
    for (const item of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from('embedding_queue')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString() 
          })
          .eq('id', item.id);
          
        // Process the item
        await processContentItem(item.content_id, item.content_type as 'post' | 'comment');
        
        // Mark as completed
        await supabase
          .from('embedding_queue')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
          
        results.push({
          id: item.id,
          content_id: item.content_id,
          content_type: item.content_type,
          success: true
        });
        
        processed++;
      } catch (error: any) {
        console.error(`Error processing ${item.content_type} ${item.content_id}:`, error);
        
        // Mark as failed
        await supabase
          .from('embedding_queue')
          .update({ 
            status: 'failed',
            error_message: error.message || String(error),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
          
        results.push({
          id: item.id,
          content_id: item.content_id,
          content_type: item.content_type,
          success: false,
          error: error.message || String(error)
        });
      }
      
      // Small delay between items to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    // Get current queue statistics
    const { data: queueStats } = await supabase.rpc('get_queue_statistics');
    
    return { processed, results, queueStats };
  } catch (error: any) {
    console.error('Error in queue processing:', error);
    throw new Error(`Queue processing error: ${error.message}`);
  }
}
```

### Step 4: Create Main Application

1. Create `src/index.ts`:
```typescript
// src/index.ts
import { processQueue } from './processors/queue-processor';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Main function to run the queue processor
 */
async function main() {
  try {
    console.log('Starting embedding queue processor...');
    
    // Process a batch of items
    const result = await processQueue();
    
    console.log(`Processed ${result.processed} items from the queue`);
    console.log('Queue statistics:', result.queueStats);
    
    if (result.results && result.results.length > 0) {
      const successCount = result.results.filter(r => r.success).length;
      const failCount = result.results.length - successCount;
      console.log(`Success: ${successCount}, Failed: ${failCount}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the main function
main();
```

2. Create a CLI script at `src/cli.ts`:
```typescript
// src/cli.ts
import { processQueue } from './processors/queue-processor';
import { processContentItem } from './processors/content-processor';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const command = args[0];

async function runCommand() {
  try {
    switch (command) {
      case 'process-queue':
        const batchSize = args[1] ? parseInt(args[1]) : undefined;
        const result = await processQueue(batchSize);
        console.log(`Processed ${result.processed} items`);
        console.log('Queue stats:', result.queueStats);
        break;
        
      case 'process-item':
        const contentId = args[1];
        const contentType = args[2] as 'post' | 'comment';
        
        if (!contentId || !contentType) {
          console.error('Usage: npm run cli process-item <content_id> <post|comment>');
          process.exit(1);
        }
        
        if (contentType !== 'post' && contentType !== 'comment') {
          console.error('Content type must be either "post" or "comment"');
          process.exit(1);
        }
        
        await processContentItem(contentId, contentType);
        console.log(`Successfully processed ${contentType} ${contentId}`);
        break;
        
      default:
        console.error('Unknown command. Available commands: process-queue, process-item');
        process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runCommand();
```

3. Update package.json scripts:
```json
"scripts": {
  "build": "tsc",
  "start": "ts-node src/index.ts",
  "cli": "ts-node src/cli.ts",
  "process-queue": "ts-node src/cli.ts process-queue",
  "process-item": "ts-node src/cli.ts process-item"
}
```

## Phase 3: Testing

### Step 1: Test Individual Components
1. Test entity extraction:
```bash
# Create a test script
cat > src/test-entity-extraction.ts << EOL
import { extractEntities } from './services/entity-extraction';

async function test() {
  const result = await extractEntities(
    'SpaceX successfully launched the Starship rocket from Texas today. Elon Musk was thrilled with the test flight results.',
    'post',
    { subreddit: 'space', title: 'SpaceX Starship Launch' }
  );
  
  console.log(JSON.stringify(result, null, 2));
}

test();
EOL

# Run the test
npx ts-node src/test-entity-extraction.ts
```

2. Test embedding generation:
```bash
# Create a test script
cat > src/test-embedding.ts << EOL
import { createEmbedding } from './services/embedding-service';

async function test() {
  const embedding = await createEmbedding('This is a test text for embedding generation');
  console.log(`Generated embedding with ${embedding.length} dimensions`);
  console.log(embedding.slice(0, 5)); // Show first 5 dimensions
}

test();
EOL

# Run the test
npx ts-node src/test-embedding.ts
```

### Step 2: Test Processing a Single Item
```bash
# Process a single post
npm run process-item <post_id> post

# Process a single comment
npm run process-item <comment_id> comment
```

### Step 3: Test Queue Processing
```bash
# Process the default batch size
npm run process-queue

# Process a custom batch size
npm run process-queue 5
```

## Phase 4: Deployment

### Step 1: Build for Production
```bash
npm run build
```

### Step 2: Containerization (Optional)
1. Create a Dockerfile:
```dockerfile
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env ./.env

CMD ["node", "dist/index.js"]
```

2. Build and run container:
```bash
docker build -t embedding-processor .
docker run --env-file .env embedding-processor
```

### Step 3: Set Up Scheduled Execution

#### Option 1: Cron Job (Linux/Unix)
```bash
# Edit crontab
crontab -e

# Add schedule (every 10 minutes)
*/10 * * * * cd /path/to/embedding-processor && npm run start >> /var/log/embedding-processor.log 2>&1
```

#### Option 2: SystemD Timer (Linux)
1. Create service file `/etc/systemd/system/embedding-processor.service`:
```
[Unit]
Description=Embedding Queue Processor
After=network.target

[Service]
Type=oneshot
User=your_user
WorkingDirectory=/path/to/embedding-processor
ExecStart=/usr/bin/npm run start
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

2. Create timer file `/etc/systemd/system/embedding-processor.timer`:
```
[Unit]
Description=Run Embedding Queue Processor periodically

[Timer]
OnBootSec=1min
OnUnitActiveSec=10min
AccuracySec=1s

[Install]
WantedBy=timers.target
```

3. Enable and start the timer:
```bash
sudo systemctl enable embedding-processor.timer
sudo systemctl start embedding-processor.timer
```

#### Option 3: Cloud Deployment
1. AWS Lambda with EventBridge trigger
2. GCP Cloud Functions with Cloud Scheduler
3. Azure Functions with Timer trigger

## Phase 5: Monitoring and Maintenance

### Step 1: Create a Queue Monitoring Script
```typescript
// src/monitor-queue.ts
import { supabase } from './services/supabase';

async function monitorQueue() {
  try {
    // Get queue statistics
    const { data: queueStats, error } = await supabase.rpc('get_queue_statistics');
    
    if (error) {
      console.error('Error fetching queue statistics:', error);
      return;
    }
    
    console.log('Queue Statistics:');
    console.log('----------------');
    console.log(`Total: ${queueStats.total}`);
    console.log(`Pending: ${queueStats.pending}`);
    console.log(`Processing: ${queueStats.processing}`);
    console.log(`Completed: ${queueStats.completed}`);
    console.log(`Failed: ${queueStats.failed}`);
    console.log(`Completion: ${queueStats.completion_percentage}%`);
    
    // Get representation types
    const { data: repTypes, error: repError } = await supabase
      .from('content_representations')
      .select('representation_type, count(*)')
      .group('representation_type');
      
    if (!repError && repTypes) {
      console.log('\nRepresentation Types:');
      console.log('--------------------');
      repTypes.forEach(r => {
        console.log(`${r.representation_type}: ${r.count}`);
      });
    }
    
    // Get recent failures
    const { data: failures, error: failError } = await supabase
      .from('embedding_queue')
      .select('id, content_id, content_type, error_message, updated_at')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5);
      
    if (!failError && failures && failures.length > 0) {
      console.log('\nRecent Failures:');
      console.log('---------------');
      failures.forEach(f => {
        console.log(`${f.content_type} ${f.content_id}: ${f.error_message}`);
      });
    }
  } catch (error) {
    console.error('Error monitoring queue:', error);
  }
}

// Run the monitor
monitorQueue();
```

### Step 2: Create Maintenance Scripts

1. Reset failed items:
```typescript
// src/reset-failed.ts
import { supabase } from './services/supabase';

async function resetFailedItems() {
  try {
    const { data, error } = await supabase
      .from('embedding_queue')
      .update({ 
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'failed');
      
    if (error) {
      console.error('Error resetting failed items:', error);
      return;
    }
    
    console.log(`Reset ${data?.length || 0} failed items to pending status`);
  } catch (error) {
    console.error('Error:', error);
  }
}

resetFailedItems();
```

2. Check stalled processing items:
```typescript
// src/check-stalled.ts
import { supabase } from './services/supabase';

async function checkStalledItems() {
  try {
    // Items stuck in processing for over 30 minutes
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    const { data, error } = await supabase
      .from('embedding_queue')
      .select('*')
      .eq('status', 'processing')
      .lt('updated_at', thirtyMinutesAgo.toISOString());
      
    if (error) {
      console.error('Error checking stalled items:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`Found ${data.length} stalled items`);
      
      // Reset stalled items to pending
      const { error: resetError } = await supabase
        .from('embedding_queue')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .in('id', data.map(item => item.id));
        
      if (resetError) {
        console.error('Error resetting stalled items:', resetError);
      } else {
        console.log(`Reset ${data.length} stalled items to pending status`);
      }
    } else {
      console.log('No stalled items found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkStalledItems();
```

## Additional Implementation Notes

1. **Error Handling**:
   - All API calls have proper error handling
   - Failed items are marked with detailed error messages
   - Monitoring tools help identify and troubleshoot issues

2. **Rate Limiting**:
   - Delays between API calls prevent OpenAI rate limiting
   - Batch processing keeps resource usage manageable

3. **Performance Monitoring**:
   - Check queue statistics regularly
   - Monitor OpenAI API usage and costs
   - Evaluate embedding quality through search performance

4. **Throttling Considerations**:
   - The system processes items in batches to avoid overwhelming resources
   - Adjust batch sizes based on server capacity and API limits

5. **Resumability**:
   - If the process is interrupted, it can resume from where it left off
   - Failed items can be retried with the reset script

6. **Progress Tracking**:
   - The queue statistics function provides real-time progress
