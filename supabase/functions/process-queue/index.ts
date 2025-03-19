// @deno-types="npm:@supabase/supabase-js@2.38.4"
import { createClient } from 'npm:@supabase/supabase-js@2.38.4'
import OpenAI from 'npm:openai@4.20.1'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Configuration constants
const BATCH_SIZE = 10;               // Maximum number of jobs to process in one run
const MAX_TOKEN_BUDGET = 100000;     // Token budget for this run (OpenAI rate limit management)
const MIN_PRIORITY_THRESHOLD = 1;    // Minimum priority to select jobs (higher = more important)
const MAX_CONCURRENCY = 5;           // Maximum number of concurrent embedding API calls

console.log('Starting process-queue function');
console.log('OpenAI API Key exists:', !!Deno.env.get('OPENAI_API_KEY'));

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

interface EmbeddingJob {
  id: number
  record_id: string
  schema_name: string
  table_name: string
  content_function: string
  embedding_column: string
  status: string
  attempts: number
  priority: number
  subreddit?: string
  estimated_tokens?: number
}

interface JobResult {
  id: string
  success: boolean
  error?: string
  chunks?: number
  tokens?: number
  processingTime?: number
}

// Estimate tokens in a string (rough approximation)
function estimateTokens(text: string): number {
  // Average English words are about 4-5 characters + space
  // GPT models average ~4 chars per token
  return Math.ceil(text.length / 4);
}

// Process a batch of jobs concurrently with rate limiting
async function processBatch(
  supabaseClient: ReturnType<typeof createClient>,
  jobs: EmbeddingJob[]
): Promise<JobResult[]> {
  // Keep track of used tokens
  let usedTokens = 0;
  const results: JobResult[] = [];
  
  // Group jobs by priority for efficient processing
  const prioritizedJobs = [...jobs].sort((a, b) => (b.priority || 1) - (a.priority || 1));
  
  // Process in smaller concurrent batches for better load management
  for (let i = 0; i < prioritizedJobs.length; i += MAX_CONCURRENCY) {
    const batchJobs = prioritizedJobs.slice(i, i + MAX_CONCURRENCY);
    
    // Process this small batch concurrently
    const batchPromises = batchJobs.map(job => processJob(supabaseClient, job, usedTokens));
    const batchResults = await Promise.all(batchPromises);
    
    // Update used tokens and add results
    for (const result of batchResults) {
      if (result.success && result.tokens) {
        usedTokens += result.tokens;
      }
      results.push(result);
    }
    
    // If we've exceeded our token budget, stop processing
    if (usedTokens >= MAX_TOKEN_BUDGET) {
      console.log(`Token budget exceeded (${usedTokens}/${MAX_TOKEN_BUDGET}). Stopping batch.`);
      break;
    }
  }
  
  return results;
}

// Process a single job
async function processJob(
  supabaseClient: ReturnType<typeof createClient>,
  job: EmbeddingJob,
  currentTokenUsage: number
): Promise<JobResult> {
  const startTime = Date.now();
  let chunkCount = 0;
  let tokenCount = 0;
  
  try {
    console.log(`Processing job for record ${job.record_id} (ID: ${job.id})`);
    
    // Mark as processing via RPC
    await supabaseClient.rpc(
      'mark_job_processing',
      { job_id: job.id }
    );

    // Get content using the specified function
    console.log(`Calling content function: ${job.content_function} with record ID: ${job.record_id}`);
    const { data: content, error: contentError } = await supabaseClient.rpc(
      job.content_function,
      { post_record: { id: job.record_id } }
    );

    if (contentError) {
      console.error(`Content function error: ${contentError.message}`);
      throw new Error(`Content function error: ${contentError.message}`);
    }
    
    if (!content) {
      console.error(`No content returned from content function for ${job.record_id}`);
      throw new Error('No content returned from content function');
    }

    // Estimate tokens before processing
    tokenCount = estimateTokens(content);
    
    // Check if this would exceed our token budget
    if (currentTokenUsage + tokenCount > MAX_TOKEN_BUDGET) {
      // Don't mark as failed, just skip and keep in queue
      await supabaseClient.rpc(
        'reset_job_status',
        { job_id: job.id }
      );
      
      return {
        id: job.record_id,
        success: false,
        error: 'Skipped due to token budget constraints',
        tokens: tokenCount
      };
    }

    console.log(`Generated content for ${job.record_id}: "${content.substring(0, 50)}..."`);
    console.log(`Estimated ${tokenCount} tokens`);
    
    // Determine if job is for post or comment
    const contentType = job.table_name.includes('post') ? 'post' : 'comment';
    
    // Call enhanced embeddings - ONLY use enhanced embeddings, never fall back
    console.log(`Using enhanced-embeddings for ${job.record_id}`);
    
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
          refreshRepresentations: true  // CRITICAL: This must be true to store representations
        })
      }
    );
    
    if (!enhancedEmbedResponse.ok) {
      const errorText = await enhancedEmbedResponse.text();
      throw new Error(`Enhanced embeddings failed: ${errorText}`);
    }
    
    const enhancedResult = await enhancedEmbedResponse.json();
    console.log(`Enhanced embeddings generated for ${job.record_id}:`, enhancedResult.embeddingTypes);
    
    // For backward compatibility, update the original embedding column
    await supabaseClient.rpc(
      'set_embedding_directly',
      { 
        p_table: job.table_name,
        p_id: job.record_id,
        p_column: job.embedding_column,
        p_embedding: null  // We're not using this column anymore
      }
    );
    
    // Record metrics
    await supabaseClient.rpc(
      'record_embedding_metrics',
      {
        p_job_type: contentType,
        p_content_length: content.length,
        p_chunk_count: enhancedResult.embeddingTypes?.length || 0,
        p_processing_time_ms: Date.now() - startTime,
        p_subreddit: job.subreddit,
        p_is_successful: true
      }
    );
    
    // Mark the job as completed via RPC
    await supabaseClient.rpc(
      'mark_job_completed',
      { job_id: job.id }
    );
    
    console.log(`Successfully processed job for ${job.record_id}`);
    return {
      id: job.record_id,
      success: true,
      chunks: enhancedResult.embeddingTypes?.length || 0,
      tokens: tokenCount,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    
    // Record failed metrics
    await supabaseClient.rpc(
      'record_embedding_metrics',
      {
        p_job_type: job.table_name.includes('post') ? 'post' : 'comment',
        p_content_length: 0, // Not known in error case
        p_chunk_count: 0,
        p_processing_time_ms: Date.now() - startTime,
        p_subreddit: job.subreddit,
        p_is_successful: false,
        p_error_message: error instanceof Error ? error.message : String(error)
      }
    );
    
    // Mark the job as failed via RPC
    await supabaseClient.rpc(
      'mark_job_failed',
      { 
        job_id: job.id, 
        error_message: error instanceof Error ? error.message : String(error)
      }
    );
    
    return {
      id: job.record_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body to extract custom parameters (if any)
    let customBatchSize = BATCH_SIZE;
    let customPriority = MIN_PRIORITY_THRESHOLD;
    let specificSubreddit: string | null = null;
    
    try {
      const body = await req.json();
      customBatchSize = body.batch_size || customBatchSize;
      customPriority = body.min_priority || customPriority;
      specificSubreddit = body.subreddit || null;
    } catch (e) {
      // No valid JSON or no body, use defaults
      console.log("Using default processing parameters");
    }
    
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    console.log(`Fetching up to ${customBatchSize} pending embedding jobs with priority >= ${customPriority}...`);
    
    // Get pending jobs with priority filtering
    let rpcParams: Record<string, any> = { 
      limit_count: customBatchSize,
      min_priority: customPriority
    };
    
    // Add subreddit filter if specified
    if (specificSubreddit) {
      rpcParams.filter_subreddit = specificSubreddit;
      console.log(`Filtering for subreddit: ${specificSubreddit}`);
    }
    
    // Get pending jobs from util.embedding_queue via RPC call
    const { data: jobs, error: fetchError } = await supabaseClient.rpc(
      'get_pending_embedding_jobs_with_priority', 
      rpcParams
    );

    if (fetchError) {
      throw new Error(`Error fetching jobs: ${fetchError.message}`);
    }

    console.log(`Found ${jobs?.length || 0} pending jobs`);

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs found' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Process jobs in batch
    const results = await processBatch(supabaseClient, jobs);
    
    // Analyze results
    const successCount = results.filter(r => r.success).length;
    const tokenCount = results.reduce((sum, r) => sum + (r.tokens || 0), 0);
    const chunkCount = results.reduce((sum, r) => sum + (r.chunks || 0), 0);
    
    return new Response(
      JSON.stringify({
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        estimated_tokens: tokenCount,
        total_chunks: chunkCount,
        details: results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error processing queue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}); 