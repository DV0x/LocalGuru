import { corsHeaders } from '../_shared/cors.ts';
// @deno-types="npm:openai@4.20.1"
import OpenAI from 'npm:openai@4.20.1';
import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * QUERY EMBEDDINGS EDGE FUNCTION
 * 
 * This function generates 512-dimensional embeddings from OpenAI's text-embedding models.
 * 
 * IMPORTANT: This function always generates 512-dimensional embeddings regardless of 
 * what's passed in the request. This is required for compatibility with the 
 * hybrid_search database function which expects exactly 512 dimensions.
 */

// Type for the query embedding request
interface QueryEmbeddingRequest {
  query: string;
  storeInCache?: boolean;
  model?: string;
  dimensions?: number;
}

// Type for the embedding response
interface EmbeddingResponse {
  embedding: number[];
  source_model: string;
  dimensions: number;
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

console.info('Query Embeddings function started (512-dimension version)');

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
if (!OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API key");
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse the request body and extract query
    const requestData = await req.json();
    console.log("Received request:", JSON.stringify(requestData, null, 2));
    
    const { query } = requestData;
    if (!query) {
      throw new Error("Query is required");
    }

    // Always use 512 dimensions for embeddings to match database functions
    const embeddingDimensions = 512;
    
    // Generate query embedding via OpenAI
    console.log(`Generating ${embeddingDimensions}-dimensional embedding for query: "${query}"`);
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: query,
        model: "text-embedding-3-large",
        dimensions: embeddingDimensions,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorDetails = await embeddingResponse.text();
      console.error("OpenAI API error:", errorDetails);
      throw new Error(`OpenAI API error: ${embeddingResponse.status} ${errorDetails}`);
    }

    const {
      data: [{ embedding }],
    } = await embeddingResponse.json();

    console.log(`Embedding generated successfully, length: ${embedding.length}`);

    // Analyze query to extract intent, topics, and locations
    // Use OpenAI to extract structured information
    console.log("Analyzing query for intent, topics, and locations");
    const instructions = `
      Analyze the following query to extract:
      1. The user's primary intent (one of: general, recommendation, information, comparison, experience, local_events, how_to, discovery)
      2. Topics mentioned (e.g., food, coffee, shopping, etc.)
      3. Specific locations mentioned (e.g., cities, neighborhoods, landmarks)

      Format your response as a JSON object with keys: "intent", "topics", and "locations".
      Only return the valid JSON object, nothing else.
    `;

    const analysisResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: instructions,
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!analysisResponse.ok) {
      const errorDetails = await analysisResponse.text();
      console.error("Query analysis error:", errorDetails);
      throw new Error(`Query analysis error: ${analysisResponse.status} ${errorDetails}`);
    }

    const analysisData = await analysisResponse.json();
    
    console.log("Analysis response:", JSON.stringify(analysisData, null, 2));
    
    let parsedResponse;
    try {
      // Extract the JSON string from the response and parse it
      const responseContent = analysisData.choices[0].message.content;
      console.log("Raw analysis content:", responseContent);
      parsedResponse = JSON.parse(responseContent);
      
      console.log("Parsed analysis:", JSON.stringify(parsedResponse, null, 2));
    } catch (e) {
      console.error("Error parsing analysis response:", e);
      // Provide default values if parsing fails
      parsedResponse = { intent: "general", topics: [], locations: [] };
    }

    // Extract intent, topics, and locations from the analysis
    const { intent = "general", topics = [], locations = [] } = parsedResponse;

    // Prepare the final response with the embedding and analysis results
    const responseData = {
      query,
      embedding,
      embeddingLength: embedding.length,
      intent,
      topics,
      locations,
      // Default values for search parameters
      maxResults: requestData.maxResults || 10,
      matchThreshold: requestData.matchThreshold || 0.6,
      vectorWeight: requestData.vectorWeight || 0.7,
      textWeight: requestData.textWeight || 0.3,
      efSearch: requestData.efSearch || 200,
    };

    console.log("Final response data:", JSON.stringify({
      ...responseData,
      embedding: `[${embedding.length} dimensions]`, // Don't log full embedding
    }, null, 2));

    // Return the response with CORS headers
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing request:", error instanceof Error ? error.message : String(error));
    
    // Return error response with CORS headers
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function createCacheKey(query: string, model: string, dimensions: number): string {
  return md5(`${query.trim().toLowerCase()}_${model}_${dimensions}`);
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