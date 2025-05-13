/**
 * Error logging utilities for the application
 */

/**
 * Log an error to the search_performance_logs table
 * This can be called from any part of the application
 */
export async function logSearchError({
  query = 'unknown query',
  errorMessage,
  durationMs = -1,
  resultCount = 0,
  source = 'system-error'
}: {
  query?: string;
  errorMessage: string;
  durationMs?: number;
  resultCount?: number;
  source?: string;
}): Promise<boolean> {
  try {
    // Determine API URL based on environment
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
    
    const errorLogUrl = `${baseUrl}/api/error-log`;
    
    // Send error to error logging endpoint
    const response = await fetch(errorLogUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        error_message: errorMessage,
        duration_ms: durationMs,
        result_count: resultCount,
        source
      })
    });
    
    // Check if logging was successful
    if (!response.ok) {
      console.error(`Error logging failed (${response.status}):`, await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception during error logging:', error);
    return false;
  }
}

/**
 * Log an error from the client-side
 * This is a browser-friendly version that handles CORS
 */
export async function logClientError(errorInfo: {
  query: string;
  errorMessage: string;
  source?: string;
}) {
  try {
    // Client-side error logging
    const response = await fetch('/api/error-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: errorInfo.query,
        error_message: errorInfo.errorMessage,
        duration_ms: -1,
        result_count: 0,
        source: errorInfo.source || 'client-side-error'
      })
    });
    
    if (!response.ok) {
      console.error('Client error logging failed:', response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception in client error logging:', error);
    return false;
  }
}

/**
 * Get error logging system health
 * Useful for monitoring the error logging system
 */
export async function getErrorLogHealth(): Promise<any> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
    
    const healthUrl = `${baseUrl}/api/error-log`;
    
    const response = await fetch(healthUrl);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking error log health:', error);
    throw error;
  }
}

/**
 * Generate a test error log entry
 * Useful for testing the error logging system
 */
export async function generateTestError(message = 'Test error message'): Promise<any> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
    
    const testUrl = `${baseUrl}/api/error-log?test=true&message=${encodeURIComponent(message)}`;
    
    const response = await fetch(testUrl);
    
    if (!response.ok) {
      throw new Error(`Test error generation failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error generating test error:', error);
    throw error;
  }
} 