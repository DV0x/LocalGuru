/**
 * Error handling utilities for API routes
 */

/**
 * Custom API error with status code
 */
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * Central error handler for API routes
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error instanceof ApiError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Handle Supabase errors (they typically have a message property)
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = (error as { message: string }).message;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Default error response for unknown errors
  return new Response(
    JSON.stringify({ error: 'An unexpected error occurred' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Logger for API errors that ensures sensitive data isn't logged
 */
export function logApiError(context: string, error: unknown) {
  // Sanitize sensitive data if needed
  const sanitizedError = error instanceof Error 
    ? { name: error.name, message: error.message } 
    : { unknown: String(error) };
  
  console.error(`API Error in ${context}:`, sanitizedError);
} 

/**
 * Utility functions for standardized API responses
 */

/**
 * Creates a standardized success response
 */
export function successResponse(data: any, status = 200) {
  return Response.json(
    { 
      success: true, 
      ...data
    }, 
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      } 
    }
  );
}

/**
 * Creates a standardized error response
 */
export function errorResponse(message: string, status = 500) {
  return Response.json(
    { 
      success: false, 
      error: message
    }, 
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      } 
    }
  );
}

/**
 * Creates a standardized "not found" response
 */
export function notFoundResponse(message = 'Resource not found') {
  return errorResponse(message, 404);
}

/**
 * Creates a standardized "unauthorized" response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401);
}

/**
 * Creates a standardized timeout response
 */
export function timeoutResponse(message = 'Request timed out', partialResults?: any) {
  return Response.json(
    { 
      success: false, 
      error: message,
      partial: true,
      ...(partialResults ? { results: partialResults } : {})
    }, 
    { 
      status: 408,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      } 
    }
  );
} 

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../utils/supabase/client-server';


import { FeedbackOptions } from '../utils/search/types';

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