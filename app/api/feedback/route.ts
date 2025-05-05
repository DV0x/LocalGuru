import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase/client-server';
import { successResponse, errorResponse } from '@/app/lib/utils/api-response';
import { handleApiError, logApiError } from '@/app/lib/utils/error-handling';
import { FeedbackOptions } from '@/app/lib/search/types';

/**
 * API route for submitting user feedback on search results
 * Securely sends the feedback to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Accept both camelCase and snake_case parameters
    const contentId = body.contentId || body.content_id;
    const isHelpful = typeof body.isHelpful !== 'undefined' ? body.isHelpful : body.is_helpful;
    const feedbackSource = body.feedbackSource || body.feedback_source || 'search_results';
    const userComments = body.userComments || body.user_comments;
    
    // Validate required fields
    if (!contentId) {
      return errorResponse('Content ID is required', 400);
    }
    
    if (!body.query) {
      return errorResponse('Query is required', 400);
    }
    
    if (typeof isHelpful !== 'boolean') {
      return errorResponse('isHelpful field is required and must be a boolean', 400);
    }
    
    // Create feedback options
    const feedbackOptions: FeedbackOptions = {
      contentId,
      query: body.query,
      isHelpful,
      feedbackSource,
      userComments
    };
    
    // Log the feedback (without sensitive data)
    console.log('Feedback submission:', { 
      contentId: feedbackOptions.contentId,
      isHelpful: feedbackOptions.isHelpful,
      timestamp: new Date().toISOString()
    });
    
    // Submit feedback to Supabase - use snake_case for the Edge Function
    const { error } = await supabaseAdmin.functions.invoke('feedback', {
      body: {
        content_id: feedbackOptions.contentId,
        query: feedbackOptions.query,
        is_helpful: feedbackOptions.isHelpful,
        feedback_source: feedbackOptions.feedbackSource,
        user_comments: feedbackOptions.userComments
      }
    });
    
    if (error) {
      throw new Error(`Feedback submission failed: ${error.message}`);
    }
    
    // Return success response
    return successResponse({ success: true });
  } catch (error) {
    logApiError('feedback API', error);
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