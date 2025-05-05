import { NextRequest } from 'next/server';
import { generateEmbeddings } from '@/utils/search/query-processor';
import { successResponse, errorResponse } from '@/utils/api-response';
import { handleApiError, logApiError } from '@/utils/error-handling';
import { withApiKeyValidation } from '@/utils/api-key-middleware';

/**
 * API route for generating embeddings for search queries
 * Proxies requests to the Supabase edge function securely
 * Protected by API key validation
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Validate query
    if (!body.query || typeof body.query !== 'string') {
      return errorResponse('Query is required and must be a string', 400);
    }
    
    // Log the embedding request (without sensitive data)
    console.log('Embedding request:', { 
      query: body.query,
      timestamp: new Date().toISOString()
    });
    
    // Generate embeddings
    const result = await generateEmbeddings(body.query);
    
    // For security and bandwidth reasons, we might want to limit what we return
    // Here we're returning everything including the full embedding vector
    return successResponse({
      query: result.query,
      embedding: result.embedding,
      cached: result.cached,
      created_at: result.created_at
    });
  } catch (error) {
    logApiError('embeddings API', error);
    return handleApiError(error);
  }
}

/**
 * Wrap the handler with API key validation middleware
 */
export const POST = withApiKeyValidation(handler);

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    }
  });
} 