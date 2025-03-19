import { NextRequest } from 'next/server';
import { analyzeQuery } from '@/app/lib/search/query-processor';
import { successResponse, errorResponse } from '@/app/lib/utils/api-response';
import { handleApiError, logApiError } from '@/app/lib/utils/error-handling';

/**
 * API route for analyzing search queries
 * Proxies requests to the Supabase edge function securely
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Validate query
    if (!body.query || typeof body.query !== 'string') {
      return errorResponse('Query is required and must be a string', 400);
    }
    
    // Log the analysis request (without sensitive data)
    console.log('Query analysis request:', { 
      query: body.query,
      timestamp: new Date().toISOString()
    });
    
    // Call the query analysis function
    const analysis = await analyzeQuery(body.query);
    
    // Return the analysis result
    return successResponse({ analysis });
  } catch (error) {
    logApiError('query-analysis API', error);
    return handleApiError(error);
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 