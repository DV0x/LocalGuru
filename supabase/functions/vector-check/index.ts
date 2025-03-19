import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

// Initialize Supabase client (using service role)
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Vector extension diagnostic function initialized');

async function runQuery(query: string, params: Record<string, any> = {}) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query }, { count: 'exact' });
    
    if (error) {
      console.error('SQL Error:', error.message);
      return { error: error.message };
    }
    
    return { data };
  } catch (error) {
    console.error('Error executing query:', error.message);
    return { error: error.message };
  }
}

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
    const { action = 'check' } = await req.json();
    const results: Record<string, any> = {};

    // Check PostgreSQL version
    results.pgVersion = await runQuery("SELECT version()");

    // Check if vector extension is available
    results.vectorAvailable = await runQuery("SELECT * FROM pg_available_extensions WHERE name = 'vector'");

    // Check if vector extension is installed
    results.vectorInstalled = await runQuery("SELECT * FROM pg_extension WHERE extname = 'vector'");

    // Get the schema of the vector extension
    results.vectorSchema = await runQuery("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'vector'");

    // Check if embedding column is using vector type
    results.embeddingColumn = await runQuery("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'reddit_posts' AND column_name = 'embedding'");

    // Create exec_sql function if it doesn't exist
    if (action === 'fix' || action === 'create_exec_sql') {
      results.createExecSql = await runQuery(`
        CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          result JSONB;
        BEGIN
          EXECUTE sql_query INTO result;
          RETURN result;
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object('error', SQLERRM);
        END;
        $$;
      `);
    }

    // Try to install or reinstall vector extension
    if (action === 'fix' || action === 'install_vector') {
      // Drop and recreate vector extension
      results.installVector = await runQuery(`
        DROP EXTENSION IF EXISTS vector;
        CREATE EXTENSION vector WITH SCHEMA public;
      `);
    }

    // Fix functions to use correct search path if needed
    if (action === 'fix' || action === 'fix_functions') {
      // Recreate parallel_search function
      results.fixParallelSearch = await runQuery(`
        CREATE OR REPLACE FUNCTION public.parallel_search(
          search_query TEXT,
          query_embedding public.vector(1536),
          similarity_threshold_docs DOUBLE PRECISION DEFAULT 0.65,
          similarity_threshold_chunks DOUBLE PRECISION DEFAULT 0.7,
          docs_weight DOUBLE PRECISION DEFAULT 0.8,
          max_results INTEGER DEFAULT 15
        )
        RETURNS TABLE (
          id TEXT,
          content_type TEXT,
          title TEXT,
          similarity DOUBLE PRECISION,
          text_preview TEXT,
          is_chunk BOOLEAN,
          chunk_index INTEGER,
          parent_title TEXT,
          subreddit TEXT
        )
        LANGUAGE plpgsql
        SECURITY INVOKER
        AS $func$
        BEGIN
          RETURN QUERY
          WITH post_results AS (
            SELECT
              p.id,
              'post' AS content_type,
              p.title,
              (1 - (p.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
              CASE WHEN length(p.content) > 200 THEN substring(p.content, 1, 200) || '...' ELSE p.content END AS text_preview,
              FALSE AS is_chunk,
              NULL::INTEGER AS chunk_index,
              NULL::TEXT AS parent_title,
              p.subreddit
            FROM public.reddit_posts p
            WHERE 1 - (p.embedding <=> query_embedding) > similarity_threshold_docs
            ORDER BY similarity DESC
            LIMIT 50
          ),
          comment_results AS (
            SELECT
              c.id,
              'comment' AS content_type,
              NULL AS title,
              (1 - (c.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
              CASE WHEN length(c.content) > 200 THEN substring(c.content, 1, 200) || '...' ELSE c.content END AS text_preview,
              FALSE AS is_chunk,
              NULL::INTEGER AS chunk_index,
              p.title AS parent_title,
              p.subreddit
            FROM public.reddit_comments c
            JOIN public.reddit_posts p ON c.post_id = p.id
            WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold_docs
            ORDER BY similarity DESC
            LIMIT 50
          )
          SELECT * FROM (
            SELECT
              id,
              content_type,
              title,
              (similarity * docs_weight)::DOUBLE PRECISION AS similarity,
              text_preview,
              is_chunk,
              chunk_index,
              parent_title,
              subreddit
            FROM post_results
            UNION ALL
            SELECT
              id,
              content_type,
              title,
              (similarity * docs_weight)::DOUBLE PRECISION AS similarity,
              text_preview,
              is_chunk,
              chunk_index,
              parent_title,
              subreddit
            FROM comment_results
          ) combined
          ORDER BY similarity DESC
          LIMIT max_results;
        END;
        $func$;
      `);

      // Recreate search_posts_by_embedding function
      results.fixSearchPostsByEmbedding = await runQuery(`
        CREATE OR REPLACE FUNCTION public.search_posts_by_embedding(
          query_embedding public.vector(1536),
          similarity_threshold float DEFAULT 0.7,
          max_results integer DEFAULT 10,
          filter_subreddit text DEFAULT NULL,
          min_score integer DEFAULT NULL,
          include_nsfw boolean DEFAULT FALSE
        )
        RETURNS TABLE (
          id text,
          subreddit text,
          title text,
          content text, 
          author_id text,
          similarity float
        )
        LANGUAGE plpgsql
        SECURITY INVOKER
        AS $func$
        BEGIN
          RETURN QUERY
          SELECT
            p.id,
            p.subreddit,
            p.title,
            p.content,
            p.author_id,
            1 - (p.embedding <=> query_embedding) AS similarity
          FROM public.reddit_posts p
          WHERE 1 - (p.embedding <=> query_embedding) > similarity_threshold
            AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
            AND (min_score IS NULL OR p.score >= min_score)
            AND (include_nsfw OR NOT p.is_nsfw)
          ORDER BY similarity DESC
          LIMIT max_results;
        END;
        $func$;
      `);
    }

    // Test if vector operations work now
    results.vectorOperationTest = await runQuery(`SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector AS distance`);
    
    return new Response(
      JSON.stringify({
        status: 'success',
        action,
        results
      }),
      { headers }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your request', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}); 