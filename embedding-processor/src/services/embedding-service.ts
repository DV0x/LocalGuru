// src/services/embedding-service.ts
import { OpenAI, APIConnectionError, APIError } from 'openai';
import { supabase } from './supabase';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure retry settings
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // Start with 1 second
const MAX_RETRY_DELAY = 60000; // Maximum 1 minute delay

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a 512-dimension embedding using text-embedding-3-large
 * Includes retry logic with exponential backoff for connectivity issues
 */
export async function createEmbedding(text: string): Promise<number[]> {
  let retries = 0;
  let lastError: any;
  
  while (retries < MAX_RETRIES) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
        encoding_format: 'float',
        dimensions: 512  // Specific 512 dimensions for HNSW
      });
      
      return response.data[0].embedding;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error or rate limit error
      const isConnectionError = error instanceof APIConnectionError;
      const isRateLimitError = error instanceof APIError && 
                              (error.status === 429 || 
                               (error.message && error.message.includes('rate limit')));
      
      if (isConnectionError || isRateLimitError) {
        retries++;
        if (retries >= MAX_RETRIES) break;
        
        // Calculate delay with exponential backoff (2^retry * initial_delay)
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retries), MAX_RETRY_DELAY);
        console.log(`Connection or rate limit error, retrying in ${delay/1000} seconds... (Attempt ${retries}/${MAX_RETRIES})`);
        
        // Add some randomness to avoid all processors retrying at the same time
        const jitter = Math.random() * 1000;
        await sleep(delay + jitter);
        continue;
      }
      
      // For non-connection, non-rate-limit errors, throw immediately
      console.error('Non-recoverable error generating embedding:', error);
      throw error;
    }
  }
  
  // If we've exhausted all retries
  console.error(`Failed to generate embedding after ${MAX_RETRIES} retries:`, lastError);
  throw lastError;
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