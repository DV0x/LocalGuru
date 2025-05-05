import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken } from '../../../lib/utils/csrf';

/**
 * GET handler for the CSRF token endpoint
 * Generates a new CSRF token and returns it to the client
 */
export async function GET(request: NextRequest) {
  try {
    // Generate a new CSRF token
    const token = await generateCsrfToken();
    
    // Return the token to the client
    return NextResponse.json({ token }, {
      headers: {
        // Set cache headers to prevent caching of the response
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Connection': 'keep-alive'
    }
  });
} 