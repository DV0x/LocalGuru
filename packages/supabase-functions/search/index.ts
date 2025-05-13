import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import OpenAI from 'npm:openai@4.12.1';

// Initialize OpenAI client (using API key from environment variable)
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Initialize Supabase client (using service role)
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface SearchRequest {
  query: string;
  similarityThresholdDocs?: number;
  similarityThresholdChunks?: number;
  docsWeight?: number;
  maxResults?: number;
  useTextSearch?: boolean;
  subreddit?: string;
  debug?: boolean;
}

console.info('Parallel search function initialized');

Deno.serve(async (req: Request) => {
  try {
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers });
    }

    // Parse request
    const { 
      query, 
      similarityThresholdDocs = 0.65, 
      similarityThresholdChunks = 0.7, 
      docsWeight = 0.8, 
      maxResults = 15, 
      useTextSearch = false, 
      subreddit = null,
      debug = false
    } = await req.json() as SearchRequest;

    // Validate request
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Invalid query parameter. Please provide a non-empty search query.' }),
        { status: 400, headers }
      );
    }

    console.log(`Processing search for: "${query}"`);
    
    // If useTextSearch flag is true, use text-based search
    if (useTextSearch) {
      console.log('Using text-based search fallback');
      
      // First try to use our new backup function that doesn't rely on pgvector
      try {
        console.log('Trying text_search_backup function first...');
        const { data, error } = await supabase.rpc(
          'text_search_backup', 
          { 
            search_query: query,
            filter_subreddit: subreddit,
            max_results: maxResults
          }
        );
        
        if (error) {
          console.warn('Error using text_search_backup:', error.message);
          throw error;
        }
        
        return new Response(
          JSON.stringify({ 
            results: data,
            searchType: 'text_backup',
            query: query
          }),
          { headers }
        );
      } catch (backupError) {
        console.warn('Backup search failed, falling back to text_search:', backupError);
        
        // If the backup function fails, try the original text_search
        const { data, error } = await supabase.rpc(
          'text_search', 
          { 
            search_query: query,
            filter_subreddit: subreddit,
            max_results: maxResults
          }
        );
        
        if (error) throw error;
        
        return new Response(
          JSON.stringify({ 
            results: data,
            searchType: 'text',
            query: query
          }),
          { headers }
        );
      }
    }
    
    // Generate embedding for the search query using OpenAI
    console.log('Generating embedding for search query...');
    const startTime = performance.now();
    
    // Use EdgeRuntime.waitUntil for potentially long-running embedding generation
    const embeddingPromise = openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float'
    });

    // Register the promise with EdgeRuntime.waitUntil if it's a long operation
    try {
      if (typeof EdgeRuntime !== 'undefined') {
        EdgeRuntime.waitUntil(embeddingPromise);
      }
    } catch (e) {
      console.warn("EdgeRuntime.waitUntil not available in this environment");
    }
    
    const embeddingResponse = await embeddingPromise;
    const embedding = embeddingResponse.data[0].embedding;
    const embeddingTime = Math.floor(performance.now() - startTime);
    console.log(`Embedding generated in ${embeddingTime}ms`);

    // If debug mode is enabled, return the embedding information
    if (debug) {
      console.log('Debug mode enabled, returning embedding info');
      
      // Take a small sample of the embedding for readability
      const embeddingSample = embedding.slice(0, 10);
      
      return new Response(
        JSON.stringify({
          debug: true,
          embeddingInfo: {
            model: 'text-embedding-3-small',
            dimensions: embedding.length,
            type: typeof embedding,
            isArray: Array.isArray(embedding),
            sample: embeddingSample,
            embeddingTime: embeddingTime
          },
          fullEmbedding: embedding  // This could be very large
        }),
        { headers }
      );
    }

    // Call parallel_search function with the embedding
    console.log('Executing parallel search...');
    
    try {
      // Debug log the parameters we're sending
      console.log('Parameters for parallel_search:');
      console.log('- query:', query);
      console.log('- embedding dimensions:', embedding.length);
      console.log('- embedding type:', typeof embedding);
      console.log('- embedding is array:', Array.isArray(embedding));
      console.log('- similarity thresholds:', similarityThresholdDocs, similarityThresholdChunks);
      
      const { data, error } = await supabase.rpc(
        'parallel_search', 
        { 
          search_query: query,
          query_embedding: embedding, 
          similarity_threshold_docs: similarityThresholdDocs,
          similarity_threshold_chunks: similarityThresholdChunks,
          docs_weight: docsWeight,
          max_results: maxResults
        }
      );
      
      if (error) {
        console.error('Error with parallel_search:', error.message);
        console.error('Error details:', error);
        throw error;
      }
      
      const totalTime = Math.floor(performance.now() - startTime);
      console.log(`Semantic search completed in ${totalTime}ms, found ${data.length} results`);
      
      return new Response(
        JSON.stringify({ 
          results: data,
          searchType: 'semantic',
          query: query,
          stats: {
            embeddingTimeMs: embeddingTime,
            totalTimeMs: totalTime,
            resultCount: data.length
          }
        }),
        { headers }
      );
    } catch (vectorSearchError) {
      console.warn('Vector search failed, falling back to text search:', vectorSearchError);
      
      // If vector search fails, fall back to text search
      console.log('Falling back to text_search_backup...');
      const { data, error } = await supabase.rpc(
        'text_search_backup', 
        { 
          search_query: query,
          filter_subreddit: subreddit,
          max_results: maxResults
        }
      );
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ 
          results: data,
          searchType: 'text_fallback',
          query: query,
          error: vectorSearchError.message
        }),
        { headers }
      );
    }
  } catch (error) {
    console.error('Error processing search request:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your search request', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}); 