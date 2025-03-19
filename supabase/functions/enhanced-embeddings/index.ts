// Enhanced Embeddings Edge Function for generating better vectors
import { createClient } from 'npm:@supabase/supabase-js@2.38.4'
import OpenAI from 'npm:openai@4.20.1'
import { extractEntities, EntityExtractionResult } from '../_shared/entity-extraction.ts'
import { 
  buildThreadContext, 
  createThreadEnhancedInput, 
  getThreadSummary,
  ThreadContext 
} from '../_shared/thread-context.ts'

interface EmbeddingRequest {
  contentId: string;
  contentType: 'post' | 'comment';
  includeContext?: boolean;
  refreshRepresentations?: boolean;
}

// Initialize OpenAI with improved error handling
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Check if OpenAI API key is present
console.log('OpenAI API Key exists:', !!Deno.env.get('OPENAI_API_KEY'));

// Helper function to chunk text for long content
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }
  
  // Simple chunking by splitting at periods, then recombining
  // to avoid cutting in the middle of sentences
  const sentences = text.split(/(?<=\.)\s+/);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed the limit, store the chunk and start a new one
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add the final chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Create a single embedding
async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Generate multiple representation types of embeddings with enhanced context
async function generateMultiRepresentationEmbeddings(
  content: any,
  contentType: 'post' | 'comment',
  threadContext: ThreadContext,
  extractedEntities: EntityExtractionResult,
  includeContext: boolean
): Promise<Record<string, { embedding: number[], metadata: Record<string, any> }>> {
  // Base content text
  const contentText = contentType === 'post' 
    ? `${content.title}\n\n${content.content || ''}`
    : content.content || '';
  
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
    
    // 1. Basic full content embedding
    embeddings.basic = {
      embedding: await createEmbedding(contentText),
      metadata: {
        type: 'basic',
        length: contentText.length,
        tokenEstimate: Math.ceil(contentText.length / 4), // Rough estimate
        ...entityMetadata  // Add entity data to metadata
      }
    };
    
    // 2. For posts, create title-specific embedding
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
    
    // 3. Context-enhanced embedding (includes metadata)
    if (includeContext) {
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
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return whatever embeddings we've generated so far
    return embeddings;
  }
}

// Store a representation in the content_representations table
async function storeContentRepresentation(
  supabaseClient: ReturnType<typeof createClient>,
  contentId: string,
  contentType: 'post' | 'comment',
  representationType: string,
  embedding: number[],
  metadata: Record<string, any> = {}
): Promise<string | null> {
  try {
    console.log(`Storing ${representationType} representation for ${contentType} ${contentId}...`);
    console.log(`Embedding length: ${embedding.length}, metadata:`, metadata);
    
    const { data, error } = await supabaseClient.rpc(
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
    
    console.log(`Successfully stored ${representationType} representation with ID:`, data);
    return data;
  } catch (error) {
    console.error(`Error in storeContentRepresentation for ${representationType}:`, error);
    return null;
  }
}

// Process embeddings with enhanced context
Deno.serve(async (req: Request) => {
  // Set up CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  try {
    console.log('Starting enhanced embeddings processing');
    
    // Parse request
    const requestData = await req.json() as EmbeddingRequest;
    const { 
      contentId, 
      contentType, 
      includeContext = true,
      refreshRepresentations = false
    } = requestData;
    
    console.log(`Processing ${contentType} with ID: ${contentId}, includeContext: ${includeContext}, refreshRepresentations: ${refreshRepresentations}`);
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { 
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );
    
    // Get content data
    let content;
    let threadContext: ThreadContext;
    let contentText = '';
    
    console.log(`Fetching ${contentType} data...`);
    
    if (contentType === 'post') {
      // Fetch post data
      const { data: post, error } = await supabaseClient
        .from('reddit_posts')
        .select('id, title, content, subreddit')
        .eq('id', contentId)
        .single();
      
      if (error || !post) {
        console.error(`Post not found: ${error?.message}`);
        return new Response(
          JSON.stringify({ error: `Post not found: ${error?.message}` }),
          { status: 404, headers }
        );
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
      // Fetch comment with post data for context
      const { data: comment, error } = await supabaseClient
        .from('reddit_comments')
        .select(`id, content, post_id, parent_id, path, 
                post:post_id (title, subreddit)`)
        .eq('id', contentId)
        .single();
      
      if (error || !comment) {
        console.error(`Comment not found: ${error?.message}`);
        return new Response(
          JSON.stringify({ error: `Comment not found: ${error?.message}` }),
          { status: 404, headers }
        );
      }
      
      content = comment;
      contentText = comment.content || '';
      
      // Get parent comments to build thread context if needed
      let parentCommentData = [];
      if (includeContext && comment.path && comment.path.length > 0) {
        const { data: parents } = await supabaseClient
          .from('reddit_comments')
          .select('id, content')
          .in('id', comment.path)
          .order('id');
        
        if (parents) {
          parentCommentData = parents;
        }
      }
      
      // Build thread context using our new utility
      threadContext = buildThreadContext(
        comment.id,
        {
          id: comment.post_id,
          title: comment.post?.title,
          subreddit: comment.post?.subreddit
        },
        parentCommentData
      );
    } else {
      console.error(`Invalid content type: ${contentType}`);
      return new Response(
        JSON.stringify({ error: `Invalid content type: ${contentType}` }),
        { status: 400, headers }
      );
    }
    
    console.log(`Content fetched successfully. Extracting entities...`);
    
    // Extract entities for metadata enrichment using our shared utility
    let extractedEntities: EntityExtractionResult;
    try {
      extractedEntities = await extractEntities(
        contentText, 
        contentType, 
        contentType === 'post' 
          ? { subreddit: threadContext.subreddit, title: threadContext.postTitle } 
          : { subreddit: threadContext.subreddit, postTitle: threadContext.postTitle }
      );
      
      console.log('Entities extracted successfully:', {
        topicCount: extractedEntities.topics.length,
        locationCount: extractedEntities.locations.length,
        semanticTagCount: extractedEntities.semanticTags.length,
        entityTypes: Object.keys(extractedEntities.entities)
      });
    } catch (entityError) {
      console.error('Entity extraction failed:', entityError);
      // Continue with default empty values if entity extraction fails
      extractedEntities = {
        entities: {},
        topics: [],
        locations: [],
        semanticTags: []
      };
    }
    
    console.log('Generating embeddings with multiple representations...');
    
    // Generate various embedding representations
    const embeddings = await generateMultiRepresentationEmbeddings(
      content,
      contentType,
      threadContext,
      extractedEntities,
      includeContext
    );
    
    console.log(`Generated ${Object.keys(embeddings).length} embedding types`);
    
    // Store representations in content_representations table
    const storedRepresentations: string[] = [];
    
    // Only store representations if requested or if they don't exist
    if (refreshRepresentations) {
      for (const [repType, repData] of Object.entries(embeddings)) {
        console.log(`Storing ${repType} representation...`);
        
        // CRITICAL FIX: Ensure metadata includes entity extraction data
        const enhancedMetadata = { 
          ...repData.metadata, 
          topics: extractedEntities.topics,
          entities: extractedEntities.entities,
          locations: extractedEntities.locations,
          semanticTags: extractedEntities.semanticTags
        };
        
        // For comments, ensure thread context is included
        if (contentType === 'comment') {
          enhancedMetadata.thread_context = threadContext;
        }
        
        const repId = await storeContentRepresentation(
          supabaseClient,
          contentId,
          contentType,
          repType,
          repData.embedding,
          enhancedMetadata  // Use enhanced metadata with entities
        );
        
        if (repId) {
          storedRepresentations.push(repType);
        }
      }
    }
    
    // Chunk content for long posts/comments
    console.log('Processing content chunking...');
    let chunks: string[] = [];
    let chunkEmbeddings: Record<string, number[]>[] = [];
    
    if (contentText.length > 500) {
      // Only chunk if content is substantial
      chunks = chunkText(contentText);
      console.log(`Created ${chunks.length} chunks from content`);
      
      // Generate embeddings for each chunk
      for (const [index, chunk] of chunks.entries()) {
        try {
          const chunkEmbedding = await createEmbedding(chunk);
          chunkEmbeddings.push({
            [`chunk_${index + 1}`]: chunkEmbedding
          });
        } catch (chunkError) {
          console.error(`Error embedding chunk ${index + 1}:`, chunkError);
        }
      }
    }
    
    console.log('Storing extracted entities...');
    
    // Store extracted entities - now including semantic tags for posts
    if (contentType === 'post') {
      await supabaseClient
        .from('reddit_posts')
        .update({
          extracted_entities: extractedEntities.entities,
          extracted_topics: extractedEntities.topics,
          extracted_locations: extractedEntities.locations,
          semantic_tags: extractedEntities.semanticTags
        })
        .eq('id', contentId);
    } else {
      const threadContextJSON = JSON.stringify({
        postTitle: threadContext.postTitle,
        subreddit: threadContext.subreddit,
        parentId: threadContext.parentId,
        path: threadContext.path,
        depth: threadContext.depth,
        summary: getThreadSummary(threadContext)
      });
      
      await supabaseClient
        .from('reddit_comments')
        .update({
          extracted_entities: extractedEntities.entities,
          extracted_topics: extractedEntities.topics,
          thread_context: threadContextJSON,
        })
        .eq('id', contentId);
    }
    
    console.log('Storing main embeddings in content_representations table...');
    
    return new Response(
      JSON.stringify({
        success: true,
        contentId,
        contentType,
        embeddingTypes: Object.keys(embeddings),
        storedRepresentations,
        chunkCount: chunks.length,
        metadata: {
          topics: extractedEntities.topics,
          locations: extractedEntities.locations
        }
      }),
      { headers }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers }
    );
  }
}); 