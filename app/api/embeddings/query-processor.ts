/**
 * Simplified query processor for the embeddings API route
 * This file includes only the essential functions needed for the route to work
 */

import { supabaseAdmin } from './supabase';

export interface EmbeddingResult {
  query: string;
  embedding: number[];
  cached?: boolean;
  created_at?: string;
}

/**
 * Generates embeddings for a search query
 * @param query The user's search query
 * @returns Embedding vector for the query
 */
export async function generateEmbeddings(query: string): Promise<EmbeddingResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('query-embeddings', {
      body: { query }
    });
    
    if (error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
    
    if (!data || !data.embedding) {
      throw new Error('No embedding data returned');
    }
    
    return data as EmbeddingResult;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
} 