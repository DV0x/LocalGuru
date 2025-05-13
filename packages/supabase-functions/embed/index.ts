// @deno-types="npm:@supabase/supabase-js@2.38.4"
import { createClient } from 'npm:@supabase/supabase-js@2.38.4'
// @deno-types="npm:openai@4.20.1"
import OpenAI from 'npm:openai@4.20.1'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

// Constants for chunking
const MAX_TOKENS = 8000 // Buffer from the 8191 limit of text-embedding-3-small
const MIN_CHUNK_SIZE = 200 // Minimum tokens for a chunk to be meaningful
const OVERLAP_SIZE = 50 // Token overlap between chunks
const TARGET_CHUNK_SIZE = 4000 // Target size for optimal embedding quality

interface EmbeddingJob {
  jobId: string | number
  id: string
  schema: string
  table: string
  contentFunction: string
  embeddingColumn: string
}

interface ContentChunk {
  parentId: string
  contentType: 'post' | 'comment'
  chunkIndex: number
  chunkText: string
  embedding?: number[]
}

interface CompletedJob extends EmbeddingJob {
  chunks?: ContentChunk[]
}

interface FailedJob extends EmbeddingJob {
  error: string
}

interface JobResult {
  completedJobs: CompletedJob[]
  failedJobs: FailedJob[]
}

/**
 * Handle embedding generation requests
 * @param {Request} req - The incoming request object
 * @returns {Promise<Response>} The response object
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the jobs from the request body
    const { jobs } = await req.json()
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No jobs provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Create a Supabase client with the Deno runtime
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Process jobs and return results
    const result = await processJobs(supabaseClient, jobs)

    // Return results
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})

// Split content into semantically meaningful chunks
function chunkContent(content: string, contentType: 'post' | 'comment'): string[] {
  // If content is small enough, return as single chunk
  if (content.length < TARGET_CHUNK_SIZE) {
    return [content];
  }
  
  // Split by paragraphs first (most semantically meaningful boundary)
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed target size and we have content,
    // finish the current chunk
    if (currentChunk.length + paragraph.length > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      
      // Start new chunk with some overlap from the end of previous chunk
      const words = currentChunk.split(' ');
      const overlapText = words.slice(Math.max(0, words.length - OVERLAP_SIZE)).join(' ');
      currentChunk = overlapText;
    }
    
    // Add paragraph to current chunk
    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }
  
  // Add the last chunk if it meets minimum size
  if (currentChunk.length >= MIN_CHUNK_SIZE) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Process jobs and return results
async function processJobs(supabaseClient: ReturnType<typeof createClient>, jobs: EmbeddingJob[]): Promise<JobResult> {
  const completedJobs: CompletedJob[] = []
  const failedJobs: FailedJob[] = []

  for (const job of jobs) {
    try {
      // Get the content to embed using the specified function
      const { data: content, error: contentError } = await supabaseClient.rpc(
        job.contentFunction,
        { post_record: { id: job.id } }
      )

      if (contentError) throw new Error(`Content function error: ${contentError.message}`)
      if (!content) throw new Error('No content returned from content function')

      // Determine content type from table name
      const contentType = job.table.includes('post') ? 'post' : 'comment';
      
      // Split content into chunks
      const contentChunks = chunkContent(content, contentType);
      
      // Store all chunks with their embeddings
      const chunks: ContentChunk[] = [];
      
      // Process each chunk
      for (let i = 0; i < contentChunks.length; i++) {
        const chunkText = contentChunks[i];
        
        // Generate embedding for this chunk
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunkText,
          encoding_format: 'float'
        });
        
        const embedding = embeddingResponse.data[0].embedding;
        
        // Store chunk with embedding
        chunks.push({
          parentId: job.id,
          contentType,
          chunkIndex: i,
          chunkText,
          embedding
        });
        
        // Insert chunk into database
        const { error: insertError } = await supabaseClient
          .from('content_chunks')
          .insert({
            parent_id: job.id,
            content_type: contentType,
            chunk_index: i,
            chunk_text: chunkText,
            embedding: embedding
          });
          
        if (insertError) {
          console.warn(`Warning: Could not insert chunk: ${insertError.message}`);
        }
      }
      
      // Also update the main record with the embedding of the first chunk
      // (for backwards compatibility and quick searches)
      if (chunks.length > 0) {
        const { error: updateError } = await supabaseClient
          .from(job.table)
          .update({ [job.embeddingColumn]: chunks[0].embedding })
          .eq('id', job.id);
          
        if (updateError) throw new Error(`Update error: ${updateError.message}`);
      }

      // Mark the job as completed in the queue
      const { error: queueUpdateError } = await supabaseClient
        .from('util.embedding_queue')
        .update({ 
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', job.jobId)

      if (queueUpdateError) {
        console.warn(`Warning: Could not update queue status: ${queueUpdateError.message}`);
      }

      completedJobs.push({...job, chunks});
    } catch (error: unknown) {
      console.error(`Error processing job ${job.jobId}:`, error instanceof Error ? error.message : String(error));
      
      // Mark the job as failed in the queue
      try {
        await supabaseClient
          .from('util.embedding_queue')
          .update({ 
            status: 'failed',
            last_error: error instanceof Error ? error.message : String(error),
            processed_at: new Date().toISOString()
          })
          .eq('id', job.jobId);
      } catch (updateError) {
        console.error(`Failed to update job status: ${updateError}`);
      }
      
      failedJobs.push({ ...job, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { completedJobs, failedJobs };
} 