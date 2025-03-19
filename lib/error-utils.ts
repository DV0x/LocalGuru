import { NextResponse } from 'next/server';

/**
 * Creates a standardized error response for API routes
 * @param status HTTP status code
 * @param message Error message
 * @returns NextResponse with error details
 */
export function createError(status: number, message: string) {
  return NextResponse.json(
    {
      error: {
        status,
        message,
      },
    },
    { status }
  );
} 