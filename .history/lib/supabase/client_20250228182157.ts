import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  }
});

/**
 * Enable the pgvector extension on the Supabase database if it's not already enabled
 */
export async function enablePgvectorExtension() {
  try {
    const { error } = await supabase.rpc('enable_pgvector_extension');
    
    if (error) {
      console.error('Error enabling pgvector extension:', error);
      throw error;
    }
    
    console.log('pgvector extension enabled successfully');
    return true;
  } catch (error) {
    console.error('Failed to enable pgvector extension:', error);
    throw error;
  }
}

/**
 * Create the necessary tables and functions for vector search
 */
export async function setupVectorStore() {
  try {
    // Create the reddit_posts table with vector column
    const { error: tableError } = await supabase.from('_exec_sql').rpc('execute', {
      query: `
        CREATE TABLE IF NOT EXISTS reddit_posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          url TEXT NOT NULL,
          subreddit TEXT NOT NULL,
          author TEXT NOT NULL,
          score INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          embedding VECTOR(1536),
          metadata JSONB
        );
      `
    });
    
    if (tableError) {
      console.error('Error creating reddit_posts table:', tableError);
      throw tableError;
    }
    
    // Create the queries table to log user queries
    const { error: queriesTableError } = await supabase.from('_exec_sql').rpc('execute', {
      query: `
        CREATE TABLE IF NOT EXISTS queries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          query TEXT NOT NULL,
          embedding VECTOR(1536),
          results JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });
    
    if (queriesTableError) {
      console.error('Error creating queries table:', queriesTableError);
      throw queriesTableError;
    }
    
    // Create index on the embedding column for faster similarity search
    const { error: indexError } = await supabase.from('_exec_sql').rpc('execute', {
      query: `
        CREATE INDEX IF NOT EXISTS reddit_posts_embedding_idx ON reddit_posts 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `
    });
    
    if (indexError) {
      console.error('Error creating index:', indexError);
      throw indexError;
    }
    
    console.log('Vector store setup completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to set up vector store:', error);
    throw error;
  }
}

/**
 * Match reddit posts based on vector similarity to the query embedding
 */
export async function matchRedditPosts(queryEmbedding: number[], limit: number = 5, similarityThreshold: number = 0.7) {
  try {
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit
    });
    
    if (error) {
      console.error('Error matching reddit posts:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to match reddit posts:', error);
    throw error;
  }
} 