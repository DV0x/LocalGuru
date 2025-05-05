import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase/client-server';
import { withApiKeyValidation } from '../../../lib/utils/api-key-middleware';

/**
 * Debug endpoint for checking database content and representations
 * Protected by API key validation
 */
async function handler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contentType = searchParams.get('type') || 'contentSummary';
  
  try {
    switch (contentType) {
      case 'contentSummary': {
        // Get content count by type
        const { data: contentCount, error: contentError } = await supabaseAdmin
          .from('content')
          .select('content_type', { count: 'exact', head: true });
          
        if (contentError) {
          return Response.json({ error: contentError.message }, { status: 500 });
        }
        
        // Get representation count by type
        const { data: repCount, error: repError } = await supabaseAdmin
          .from('content_representations')
          .select('representation_type', { count: 'exact', head: true });
          
        if (repError) {
          return Response.json({ error: repError.message }, { status: 500 });
        }
        
        // Get embedding stats
        const { data: embeddingStats, error: statsError } = await supabaseAdmin.rpc(
          'debug_embedding_statistics'
        );
        
        return Response.json({
          content: {
            totalCount: contentCount,
          },
          representations: {
            totalCount: repCount,
          },
          embeddingStats: embeddingStats || { error: statsError?.message },
          message: 'Check logs for more detailed DB connection info'
        });
      }
      
      case 'testSearch': {
        const query = searchParams.get('query') || 'test';
        const threshold = parseFloat(searchParams.get('threshold') || '0.3');
        
        // Generate a test embedding
        const { data: embeddingData, error: embeddingError } = await supabaseAdmin.functions.invoke('query-embeddings', {
          body: { query }
        });
        
        if (embeddingError) {
          return Response.json({ error: `Embedding generation failed: ${embeddingError.message}` }, { status: 500 });
        }
        
        const embedding = embeddingData.embedding;
        
        // Test direct representation search
        const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
          'search_content_representations',
          {
            query,
            query_embedding: embedding,
            representation_types: ['basic', 'context_enhanced', 'title'],
            max_results: 5,
            similarity_threshold: threshold
          }
        );
        
        if (searchError) {
          return Response.json({ error: `Search failed: ${searchError.message}` }, { status: 500 });
        }
        
        return Response.json({
          query,
          threshold,
          embeddingSize: embedding?.length,
          resultsCount: searchResults?.length || 0,
          results: searchResults
        });
      }
      
      case 'testMultiStrategy': {
        const query = searchParams.get('query') || 'test';
        const threshold = parseFloat(searchParams.get('threshold') || '0.6');
        
        // Get query analysis
        const { data: analysisData, error: analysisError } = await supabaseAdmin.functions.invoke('query-analysis', {
          body: { query }
        });
        
        if (analysisError) {
          return Response.json({ error: `Query analysis failed: ${analysisError.message}` }, { status: 500 });
        }
        
        // Generate embeddings
        const { data: embeddingData, error: embeddingError } = await supabaseAdmin.functions.invoke('query-embeddings', {
          body: { query }
        });
        
        if (embeddingError) {
          return Response.json({ error: `Embedding generation failed: ${embeddingError.message}` }, { status: 500 });
        }
        
        const embedding = embeddingData.embedding;
        
        // Direct test of multi_strategy_search
        const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
          'multi_strategy_search',
          {
            p_query: query,
            p_query_embedding: embedding,
            p_query_intent: analysisData.intent || 'general',
            p_query_topics: analysisData.topics || [],
            p_query_locations: analysisData.locations || [],
            p_max_results: 10,
            p_match_threshold: threshold
          }
        );
        
        if (searchError) {
          return Response.json({ 
            error: `Multi-strategy search failed: ${searchError.message}`,
            details: searchError
          }, { status: 500 });
        }
        
        return Response.json({
          query,
          threshold,
          analysis: {
            intent: analysisData.intent,
            topics: analysisData.topics,
            locations: analysisData.locations
          },
          embeddingSize: embedding?.length,
          resultsCount: searchResults?.length || 0,
          results: searchResults
        });
      }
      
      default:
        return Response.json({ error: 'Unknown debug type' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Wrap the handler with API key validation middleware
 */
export const GET = withApiKeyValidation(handler);

// Create RPC function for embedding statistics
/*
CREATE OR REPLACE FUNCTION debug_embedding_statistics()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'content_count', (SELECT count(*) FROM content),
    'content_with_basic_embedding', (SELECT count(*) FROM content WHERE content_embedding IS NOT NULL),
    'content_with_title_embedding', (SELECT count(*) FROM content WHERE title_embedding IS NOT NULL),
    'content_with_context_embedding', (SELECT count(*) FROM content WHERE context_enhanced_embedding IS NOT NULL),
    'representation_count', (SELECT count(*) FROM content_representations),
    'representation_types', (SELECT jsonb_object_agg(representation_type, count) FROM 
                             (SELECT representation_type, count(*) FROM content_representations 
                              GROUP BY representation_type) subq)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
*/ 