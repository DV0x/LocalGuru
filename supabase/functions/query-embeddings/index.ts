import { corsHeaders } from '../_shared/cors.ts';
// @deno-types="npm:openai@4.20.1"
import OpenAI from 'npm:openai@4.20.1';
import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import { crypto } from 'npm:@peculiar/webcrypto@1.4.3';

// Type for the query embedding request
interface QueryEmbeddingRequest {
  query: string;
  storeInCache?: boolean;
}

// Type for the embedding response
interface EmbeddingResponse {
  embedding: number[];
  source_model: string;
  cached: boolean;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI client setup
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Logging function
const log = (message: string, data?: any) => {
  console.log(`[query-embeddings] ${message}`, data ? JSON.stringify(data) : '');
};

console.info('Query Embeddings function started');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { query, storeInCache = true } = await req.json() as QueryEmbeddingRequest;

    if (!query || query.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Query is required',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Generate a cache key from the query
    const cacheKey = createCacheKey(query);
    
    // Check cache first
    if (storeInCache) {
      log('Checking cache', { cacheKey });
      const { data: cachedEmbedding, error: cacheError } = await supabase
        .from('embedding_cache')
        .select('embedding, source_model')
        .eq('query_hash', cacheKey)
        .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(1)
        .single();
      
      if (!cacheError && cachedEmbedding) {
        log('Cache hit', { model: cachedEmbedding.source_model });
        return new Response(
          JSON.stringify({
            embedding: cachedEmbedding.embedding,
            source_model: cachedEmbedding.source_model,
            cached: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      log('Cache miss, generating new embedding');
    }
    
    // Call OpenAI to generate embeddings
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!openaiKey) {
      log('Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'Missing OpenAI API key' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
    
    // Generate embeddings from OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-3-small'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log('OpenAI API error', { status: response.status, error: errorText });
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    
    const responseData = await response.json();
    const embedding = responseData.data[0].embedding;
    const model = responseData.model || 'text-embedding-3-small';
    
    log('Embedding generated', { model, embeddingLength: embedding.length });
    
    // Store in cache if requested
    if (storeInCache) {
      log('Storing in cache', { cacheKey, model });
      const { error: storeError } = await supabase
        .from('embedding_cache')
        .upsert({
          query_hash: cacheKey,
          query_text: query,
          embedding,
          source_model: model,
          created_at: new Date().toISOString()
        });
      
      if (storeError) {
        log('Error storing in cache', storeError);
      }
    }
    
    // Return the embeddings
    const result: EmbeddingResponse = {
      embedding,
      source_model: model,
      cached: false
    };
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    log('Unexpected error', error);
    return new Response(
      JSON.stringify({
        error: `Unexpected error: ${error.message || 'Unknown error'}`,
        details: String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

function createCacheKey(query: string): string {
  return md5(query.trim().toLowerCase());
}

// Simple MD5 function that works in Deno
function md5(input: string): string {
  // Convert string to a Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  
  // Create a simple hash (for demonstration, not secure)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to a hex string
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return hashHex.repeat(4).substring(0, 32);
} 