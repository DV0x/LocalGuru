import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

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
 * Execute raw SQL query on Supabase
 */
export async function executeSQL(sql: string) {
  try {
    // Use the REST API directly for executing SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error executing SQL:', errorText);
      return { success: false, error: errorText };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error executing SQL:', error);
    return { success: false, error };
  }
}

/**
 * Enable the pgvector extension on the Supabase database
 */
export async function enablePgvectorExtension() {
  return executeSQL('CREATE EXTENSION IF NOT EXISTS vector;');
}

/**
 * Create the reddit_posts table with vector column
 */
export async function createRedditPostsTable() {
  return executeSQL(`
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
  `);
}

/**
 * Create the queries table to log user queries
 */
export async function createQueriesTable() {
  return executeSQL(`
    CREATE TABLE IF NOT EXISTS queries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query TEXT NOT NULL,
      embedding VECTOR(1536),
      results JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
}

/**
 * Create index on the embedding column for faster similarity search
 */
export async function createEmbeddingIndex() {
  return executeSQL(`
    CREATE INDEX IF NOT EXISTS reddit_posts_embedding_idx ON reddit_posts 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  `);
}

/**
 * Create the match_documents function for vector similarity search
 */
export async function createMatchDocumentsFunction() {
  return executeSQL(`
    CREATE OR REPLACE FUNCTION match_documents(
      query_embedding VECTOR(1536),
      match_threshold FLOAT,
      match_count INT
    )
    RETURNS TABLE (
      id UUID,
      post_id TEXT,
      title TEXT,
      content TEXT,
      url TEXT,
      subreddit TEXT,
      author TEXT,
      score INTEGER,
      created_at TIMESTAMP WITH TIME ZONE,
      similarity FLOAT
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        rp.id,
        rp.post_id,
        rp.title,
        rp.content,
        rp.url,
        rp.subreddit,
        rp.author,
        rp.score,
        rp.created_at,
        1 - (rp.embedding <=> query_embedding) AS similarity
      FROM reddit_posts rp
      WHERE 1 - (rp.embedding <=> query_embedding) > match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    END;
    $$;
  `);
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