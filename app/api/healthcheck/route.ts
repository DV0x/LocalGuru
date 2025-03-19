import { NextRequest } from 'next/server';

/**
 * Simple health check endpoint that returns a 200 OK
 * Used for handling redirected requests
 */
export async function GET() {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Server is running'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Also handle POST requests to this endpoint
 */
export async function POST() {
  return new Response(JSON.stringify({
    success: true,
    results: [],
    message: 'Request handled successfully'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 